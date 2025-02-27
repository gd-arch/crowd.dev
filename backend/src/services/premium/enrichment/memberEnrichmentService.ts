import axios from 'axios'
import lodash from 'lodash'
import { IServiceOptions } from '../../IServiceOptions'
import { LoggingBase } from '../../loggingBase'
import {
  EnrichmentAPIResponse,
  EnrichmentAPIMember,
  EnrichmentAPIContribution,
  EnrichmentAPISkills,
  EnrichmentAPIEducation,
  EnrichmentAPICertification,
  EnrichmentAPIWorkExperience,
} from './types/memberEnrichmentTypes'
import { ENRICHMENT_CONFIG } from '../../../config'
import Error400 from '../../../errors/Error400'
import MemberService from '../../memberService'
import { PlatformType } from '../../../types/integrationEnums'
import MemberAttributeSettingsService from '../../memberAttributeSettingsService'
import { AttributeData } from '../../../database/attributes/attribute'
import { Member } from '../../../serverless/integrations/types/messageTypes'
import {
  MemberAttributeName,
  MemberEnrichmentAttributeName,
  MemberEnrichmentAttributes,
} from '../../../database/attributes/member/enums'
import { AttributeType } from '../../../database/attributes/types'
import { i18n } from '../../../i18n'
import RedisPubSubEmitter from '../../../utils/redis/pubSubEmitter'
import { createRedisClient } from '../../../utils/redis'
import { ApiWebsocketMessage } from '../../../types/mq/apiWebsocketMessage'
import MemberEnrichmentCacheRepository from '../../../database/repositories/memberEnrichmentCacheRepository'
import track from '../../../segment/track'

export default class MemberEnrichmentService extends LoggingBase {
  options: IServiceOptions

  attributes: AttributeData[] | undefined

  attributeSettings: any

  constructor(options) {
    super(options)
    this.options = options
    this.attributes = undefined

    // This code defines an object, attributeSettings, which maps specific member attributes to their corresponding fields within a data source, as well as their attribute type and any additional information needed for processing the attribute.
    // For example, the AVATAR_URL attribute maps to the profile_pic_url field in the data source and has a default value of true.
    // The object is used to define the fields, types and any additional information needed for processing the member attributes.
    this.attributeSettings = {
      [MemberAttributeName.AVATAR_URL]: {
        fields: ['profile_pic_url'],
        default: true,
      },
      [MemberAttributeName.LOCATION]: {
        fields: ['location'],
        default: true,
      },
      [MemberAttributeName.BIO]: {
        fields: ['title', 'work_experiences[0].title'],
      },
      [MemberEnrichmentAttributeName.SENIORITY_LEVEL]: {
        fields: ['seniority_level'],
        type: AttributeType.STRING,
      },
      [MemberEnrichmentAttributeName.COUNTRY]: {
        fields: ['country'],
        type: AttributeType.STRING,
      },
      [MemberEnrichmentAttributeName.PROGRAMMING_LANGUAGES]: {
        fields: ['programming_languages'],
        type: AttributeType.MULTI_SELECT,
      },
      [MemberEnrichmentAttributeName.LANGUAGES]: {
        fields: ['languages'],
        type: AttributeType.MULTI_SELECT,
      },
      [MemberEnrichmentAttributeName.YEARS_OF_EXPERIENCE]: {
        fields: ['years_of_experience'],
        type: AttributeType.NUMBER,
      },
      [MemberEnrichmentAttributeName.EXPERTISE]: {
        fields: ['expertise'],
        type: AttributeType.MULTI_SELECT,
      },
      [MemberEnrichmentAttributeName.WORK_EXPERIENCES]: {
        fields: ['work_experiences'],
        type: AttributeType.SPECIAL,
        fn: (workExperiences: EnrichmentAPIWorkExperience[]) =>
          workExperiences.map((workExperience) => {
            const { title, company, location, startDate, endDate } = workExperience
            return {
              title,
              company,
              location,
              startDate,
              endDate: endDate || 'Present',
            }
          }),
      },
      [MemberEnrichmentAttributeName.EDUCATION]: {
        fields: ['educations'],
        type: AttributeType.SPECIAL,
        fn: (educations: EnrichmentAPIEducation[]) =>
          educations.map((education) => {
            const { campus, major, specialization, startDate, endDate } = education
            return {
              campus,
              major,
              specialization,
              startDate,
              endDate: endDate || 'Present',
            }
          }),
      },
      [MemberEnrichmentAttributeName.AWARDS]: {
        fields: ['awards'],
        type: AttributeType.SPECIAL,
      },
      [MemberEnrichmentAttributeName.CERTIFICATIONS]: {
        fields: ['certifications'],
        type: AttributeType.SPECIAL,
        fn: (certifications: EnrichmentAPICertification[]) =>
          certifications.map((certification) => {
            const { title, description } = certification
            return {
              title,
              description,
            }
          }),
      },
    }
  }

  async getAttributes() {
    const memberAttributeSettingsService = new MemberAttributeSettingsService(this.options)
    this.attributes = (await memberAttributeSettingsService.findAndCountAll({})).rows
  }

  async bulkEnrich(memberIds: string[]) {
    const redis = await createRedisClient(true)

    const apiPubSubEmitter = new RedisPubSubEmitter('api-pubsub', redis, (err) => {
      this.log.error({ err }, 'Error in api-ws emitter!')
    })
    let enrichedMembers = 0
    for (const memberId of memberIds) {
      try {
        await this.enrichOne(memberId)
        enrichedMembers++
        this.log.info(`Enriched member ${memberId}`)
      } catch (err) {
        if (
          err.message === i18n(this.options.language, 'enrichment.errors.noGithubHandleOrEmail')
        ) {
          this.log.warn(`Member ${memberId} has no GitHub handle or email address`)
          // eslint-disable-next-line no-continue
          continue
        } else {
          this.log.error(`Failed to enrich member ${memberId}`, err)
        }
      }
    }

    // Send websocket messages to frontend after all requests have been made
    // Only send error message if all enrichments failed
    if (!enrichedMembers) {
      apiPubSubEmitter.emit(
        'user',
        new ApiWebsocketMessage(
          'bulk-enrichment',
          JSON.stringify({
            failedEnrichedMembers: memberIds.length - enrichedMembers,
            enrichedMembers,
            tenantId: this.options.currentTenant.id,
            success: false,
          }),
          undefined,
          this.options.currentTenant.id,
        ),
      )
    }
    // Send success message if there were enrichedMembers
    else {
      apiPubSubEmitter.emit(
        'user',
        new ApiWebsocketMessage(
          'bulk-enrichment',
          JSON.stringify({
            enrichedMembers,
            tenantId: this.options.currentTenant.id,
            success: true,
          }),
          undefined,
          this.options.currentTenant.id,
        ),
      )
    }

    return { enrichedMemberCount: enrichedMembers }
  }

  /**
   * This function is used to enrich a member's profile with data from the Enrichment API.
   * It first looks up the member using the provided member ID and MemberService.
   * If the member's GitHub handle or email address is not available, an error is thrown.
   * If the member's GitHub handle is available, it is used to make a request to the Enrichment API
   * and the returned data is returned.
   * @param memberId - the ID of the member to enrich
   * @returns a promise that resolves to the enrichment data for the member
   */
  async enrichOne(memberId) {
    // If the attributes have not been fetched yet, fetch them
    if (!this.attributes) {
      await this.getAttributes()
    }

    // Create an instance of the MemberService and use it to look up the member
    const memberService = new MemberService(this.options)
    const member = await memberService.findById(memberId, false, false)

    // If the member's GitHub handle or email address is not available, throw an error
    if (!member.username[PlatformType.GITHUB] && member.emails.length === 0) {
      throw new Error400(this.options.language, 'enrichment.errors.noGithubHandleOrEmail')
    }

    let enrichedFrom = ''
    let enrichmentData: EnrichmentAPIMember
    // If the member has a GitHub handle, use it to make a request to the Enrichment API
    if (member.username[PlatformType.GITHUB]) {
      enrichedFrom = 'github'
      enrichmentData = await this.getEnrichmentByGithubHandle(member.username[PlatformType.GITHUB])
    } else if (member.emails.length > 0) {
      enrichedFrom = 'email'
      // If the member has an email address, use it to make a request to the Enrichment API
      enrichmentData = await this.getEnrichmentByEmail(member.emails[0])
    }

    if (enrichmentData) {
      // save raw data to cache
      await MemberEnrichmentCacheRepository.upsert(memberId, enrichmentData, this.options)

      const normalized = await this.normalize(member, enrichmentData)

      // We are updating the displayName only if the existing one has one word only
      // And we are using an update here instead of the upsert because
      // upsert always takes the existing displayName
      if (!/\W/.test(member.displayName)) {
        if (enrichmentData.first_name && enrichmentData.last_name) {
          await memberService.update(member.id, {
            displayName: `${enrichmentData.first_name} ${enrichmentData.last_name}`,
          })
        }
      }

      track(
        'Member Enriched',
        {
          memberId: member.id,
          enrichedFrom,
        },
        this.options,
      )

      return memberService.upsert({ ...normalized, platform: PlatformType.GITHUB })
    }
    return null
  }

  async normalize(member: Member, enrichmentData: EnrichmentAPIMember) {
    member.lastEnriched = new Date()

    const enrichedBy = new Set<string>(member.enrichedBy).add(this.options.currentUser.id)
    member.enrichedBy = Array.from(enrichedBy)

    if (enrichmentData.emails.length > 0) {
      const emailSet = new Set<string>(
        enrichmentData.emails.filter((email) => !email.includes('noreply.github')),
      )
      member.emails.forEach((email) => emailSet.add(email))
      member.emails = Array.from(emailSet)
    }
    member.contributions = enrichmentData.oss_contributions?.map(
      (contribution: EnrichmentAPIContribution) => ({
        id: contribution.id,
        topics: contribution.topics,
        summary: contribution.summary,
        url: contribution.github_url,
        firstCommitDate: contribution.first_commit_date,
        lastCommitDate: contribution.last_commit_date,
        numberCommits: contribution.num_of_commits,
      }),
    )
    member = this.fillPlatformData(member, enrichmentData)
    member = await this.fillAttributes(member, enrichmentData)
    member = await this.fillSkills(member, enrichmentData)
    return member
  }

  /**
   * This function is used to fill in a member's social media handles and profile links based on data obtained from an external API
   * @param member - The object that contains properties such as 'username' and 'attributes'
   * @param enrichmentData - An object that contains data obtained from an external API
   * @returns the updated 'member' object
   */
  // eslint-disable-next-line class-methods-use-this
  fillPlatformData(member: Member, enrichmentData: EnrichmentAPIMember) {
    if (enrichmentData.github_handle) {
      // Set 'member.username.github' to be equal to 'enrichmentData.github_handle' (if it is not already set)
      member.username[PlatformType.GITHUB] =
        member.username[PlatformType.GITHUB] || enrichmentData.github_handle
      if (!member.attributes.url) {
        // If it does not exist, initialize it as an empty object
        member.attributes.url = {}
      }
      // Set 'member.attributes.url.github' to be equal to a string concatenated with the 'github_handle' property
      member.attributes.url.github =
        member.attributes.url.github || `https://github.com/${enrichmentData.github_handle}`
    }

    if (enrichmentData.linkedin_url) {
      member.username[PlatformType.LINKEDIN] =
        member.username[PlatformType.LINKEDIN] || enrichmentData.linkedin_url.split('/').pop()

      if (!member.attributes.url) {
        member.attributes.url = {}
      }

      member.attributes.url.linkedin = member.attributes.url.linkedin || enrichmentData.linkedin_url
    }

    if (enrichmentData.twitter_handle) {
      member.username[PlatformType.TWITTER] =
        member.username[PlatformType.TWITTER] || enrichmentData.twitter_handle

      if (!member.attributes.url) {
        member.attributes.url = {}
      }
      member.attributes.url.twitter =
        member.attributes.url.twitter || `https://twitter.com/${enrichmentData.twitter_handle}`
    }

    return member
  }

  /**
   * This function is used to fill in a member's attributes based on data obtained from an external API
   * @param member - The object that contains properties such as 'attributes'
   * @param enrichmentData - An object that contains data obtained from an external API
   * @returns the updated 'member' object
   */
  async fillAttributes(member: Member, enrichmentData: EnrichmentAPIMember) {
    // Check if 'member.attributes' property exists
    if (!member.attributes) {
      // If it does not exist, initialize it as an empty object
      member.attributes = {}
    }

    // eslint-disable-next-line guard-for-in
    for (const attributeName in this.attributeSettings) {
      const attribute = this.attributeSettings[attributeName]

      let value = null

      for (const field of attribute.fields) {
        if (value) {
          break
        }
        // Get value from 'enrichmentData' object using the defined mapping and 'lodash.get'
        value = lodash.get(enrichmentData, field)
      }

      if (value) {
        // Check if 'member.attributes[attributeName]' exists, and if it does not, initialize it as an empty object
        if (!member.attributes[attributeName]) {
          member.attributes[attributeName] = {}
        }

        // Check if 'attribute.fn' exists, otherwise set it the identity function
        const fn = attribute.fn || ((value) => value)
        value = fn(value)

        // Assign 'value' to 'member.attributes[attributeName].enrichment'
        member.attributes[attributeName].enrichment = value

        await this.createAttributeAndUpdateOptions(attributeName, attribute, value)
      }
    }

    return member
  }

  /**
   * This function is used to fill in a member's skills based on data obtained from an external API
   * @param member - The object that contains properties such as 'attributes'
   * @param enrichmentData - An object that contains data obtained from an external API
   * @returns the updated 'member' object
   */
  async fillSkills(member: Member, enrichmentData: EnrichmentAPIMember) {
    // Check if 'enrichmentData.skills' properties exists
    if (enrichmentData.skills) {
      if (!member.attributes.skills) {
        member.attributes.skills = {}
      }

      // Assign unique and ordered skills to 'member.attributes[MemberEnrichmentAttributeName.SKILLS].enrichment'
      member.attributes[MemberEnrichmentAttributeName.SKILLS].enrichment = lodash.uniq([
        // Use 'lodash.orderBy' to sort the skills by weight in descending order
        ...lodash
          .orderBy(enrichmentData.skills || [], ['weight'], ['desc'])
          .map((s: EnrichmentAPISkills) => s.skill),
      ])

      await this.createAttributeAndUpdateOptions(
        MemberEnrichmentAttributeName.SKILLS,
        { type: AttributeType.MULTI_SELECT },
        member.attributes.skills.enrichment,
      )
    }

    return member
  }

  /**
   * This function is used to create new attribute and update options for member's attributes
   * @param attributeName - The name of the attribute
   * @param attribute - The attribute object
   * @param value - the value of the attribute
   */
  async createAttributeAndUpdateOptions(attributeName, attribute, value) {
    // Check if attribute type is 'MULTI_SELECT' and the attribute already exists
    if (
      attribute.type === AttributeType.MULTI_SELECT &&
      lodash.find(this.attributes, { name: attributeName })
    ) {
      // Find attributeSettings by name
      const attributeSettings = lodash.find(this.attributes, { name: attributeName })
      // Get options
      const options = attributeSettings.options || []
      // Update options
      await new MemberAttributeSettingsService(this.options).update(attributeSettings.id, {
        options: lodash.uniq([...options, ...value]),
      })
    }

    // Check if the attribute does not exist and it is not a default attribute
    if (!(lodash.find(this.attributes, { name: attributeName }) || attribute.default)) {
      // Create new attribute if it does not exist
      this.attributes[attributeName] = await new MemberAttributeSettingsService(
        this.options,
      ).create({
        name: attributeName,
        label: MemberEnrichmentAttributes[attributeName].label,
        type: attribute.type,
        show: attributeName !== MemberEnrichmentAttributeName.EMAILS,
        canDelete: false,
        ...(attribute.type === AttributeType.MULTI_SELECT && { options: value }),
      })
    }
  }

  /**
   * This function is used to get an enrichment profile for a given GitHub handle.
   * It makes a GET request to the Enrichment API with the provided GitHub handle and an API key,
   * and returns the profile data from the API response.
   * If the request fails, it logs the error and throws a custom error.
   * @param githubHandle - the GitHub handle of the member to get the enrichment profile for
   * @returns a promise that resolves to the enrichment profile for the given GitHub handle
   */
  async getEnrichmentByGithubHandle(githubHandle: number): Promise<EnrichmentAPIMember> {
    try {
      // Construct the API url and the config for the GET request
      const url = `${ENRICHMENT_CONFIG.url}/get_profile`
      const config = {
        method: 'get',
        url,
        params: {
          github_handle: githubHandle,
          with_emails: true,
          api_key: ENRICHMENT_CONFIG.apiKey,
        },
        headers: {},
      }
      // Make the GET request and extract the profile data from the response
      const response: EnrichmentAPIResponse = (await axios(config)).data

      if (response.error) {
        this.log.error(githubHandle, `Member not found using github handle.`)
        throw new Error400(this.options.language, 'enrichment.errors.memberNotFound')
      }
      return response.profile
    } catch (error) {
      // Log the error and throw a custom error
      this.log.error({ error, githubHandle }, 'Enrichment failed')
      throw error
    }
  }

  /**
   * This function is used to get an enrichment profile for a given email.
   * It makes a GET request to the Enrichment API with the provided email and an API key,
   * and returns the profile data from the API response.
   * If the request fails, it logs the error and throws a custom error.
   * @param email - the email of the member to get the enrichment profile for
   * @returns a promise that resolves to the enrichment profile for the given email
   */
  async getEnrichmentByEmail(email: string): Promise<EnrichmentAPIMember> {
    try {
      // Construct the API url and the config for the GET request
      const url = `${ENRICHMENT_CONFIG.url}/get_profile`
      const config = {
        method: 'get',
        url,
        params: {
          email,
          with_emails: true,
          api_key: ENRICHMENT_CONFIG.apiKey,
        },
        headers: {},
      }
      // Make the GET request and extract the profile data from the response
      const response: EnrichmentAPIResponse = (await axios(config)).data
      if (response.error) {
        this.log.error(email, `Member not found using email.`)
        throw new Error400(this.options.language, 'enrichment.errors.memberNotFound')
      }
      return response.profile
    } catch (error) {
      // Log the error and throw a custom error
      this.log.error({ error, email }, 'Enrichment failed')
      throw error
    }
  }
}
