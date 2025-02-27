import PermissionChecker from '../../../services/user/permissionChecker'
import Permissions from '../../../security/permissions'
import IntegrationService from '../../../services/integrationService'

export default async (req, res) => {
  // Checking we have permision to edit the integration
  new PermissionChecker(req).validateHas(Permissions.values.integrationEdit)

  const urlSearchParams = new URLSearchParams(req.query.state)
  const redirectUrl = urlSearchParams.get('redirectUrl')
  const hashtags = urlSearchParams.get('hashtags')

  const integrationData = {
    profileId: req.user.twitter.profile.id,
    token: req.user.twitter.accessToken,
    refreshToken: req.user.twitter.refreshToken,
    hashtags,
  }
  await new IntegrationService(req).twitterCallback(integrationData)

  res.redirect(redirectUrl)
}
