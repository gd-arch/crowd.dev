<template>
  <app-page-wrapper>
    <div class="mb-10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-6">
          <h4>Community Help Center</h4>
          <span
            v-if="!hasPremiumPlan"
            class="badge badge--sm"
          >Free</span>
        </div>
        <div class="flex items-center">
          <app-community-help-center-settings
            class="mr-2"
            :visible="hasSettingsVisible"
            @open="doOpenSettingsDrawer"
            @close="doCloseSettingsDrawer"
          />
          <el-tooltip
            content="Activate the public page in Settings"
            placement="top"
            :disabled="isConfigured"
          >
            <div>
              <a
                :href="
                  isConfigured
                    ? computedCrowdOpenLink
                    : undefined
                "
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-brand--secondary btn--md"
                :class="{
                  disabled: !isConfigured,
                }"
              ><i class="ri-external-link-line mr-2" />Open public page</a>
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="text-xs text-gray-500">
        Overview of all members from your community
      </div>
    </div>
    <app-community-help-center-tabs />
    <app-community-help-center-filter />
    <app-community-help-center-table
      @open-conversation-drawer="onConversationDrawerOpen"
    />

    <app-community-help-center-conversation-drawer
      :expanded="!!drawerConversationId"
      :conversation-id="drawerConversationId"
      @close="onConversationDrawerClose"
    />
  </app-page-wrapper>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import config from '@/config';
import { FeatureFlag } from '@/featureFlag';
import AppCommunityHelpCenterTable from '@/premium/community-help-center/components/community-help-center-table.vue';
import AppCommunityHelpCenterTabs from '@/premium/community-help-center/components/community-help-center-tabs.vue';
import AppCommunityHelpCenterFilter from '@/premium/community-help-center/components/community-help-center-filter.vue';
import AppCommunityHelpCenterSettings from '@/premium/community-help-center/components/community-help-center-settings.vue';
import AppCommunityHelpCenterConversationDrawer from '@/premium/community-help-center/components/community-help-center-conversation-drawer.vue';

export default {
  name: 'AppConversationListPage',

  components: {
    AppCommunityHelpCenterTable,
    AppCommunityHelpCenterTabs,
    AppCommunityHelpCenterFilter,
    AppCommunityHelpCenterSettings,
    AppCommunityHelpCenterConversationDrawer,
  },

  data() {
    return {
      drawerConversationId: null,
      hasPremiumPlan: false,
    };
  },

  computed: {
    ...mapGetters({
      currentTenant: 'auth/currentTenant',
      isConfigured: 'communityHelpCenter/isConfigured',
      hasSettingsVisible:
        'communityHelpCenter/hasSettingsVisible',
    }),
    computedCrowdOpenLink() {
      return `${config.conversationPublicUrl}/${this.currentTenant.url}`;
    },
  },

  async created() {
    const isFeatureEnabled = FeatureFlag.isFlagEnabled(
      FeatureFlag.flags.communityCenterPro,
    );

    this.hasPremiumPlan = config.hasPremiumModules && isFeatureEnabled;
  },

  async mounted() {
    window.analytics.page('Community Help Center');
  },

  methods: {
    ...mapActions({
      doOpenSettingsDrawer:
        'communityHelpCenter/doOpenSettingsDrawer',
      doCloseSettingsDrawer:
        'communityHelpCenter/doCloseSettingsDrawer',
    }),
    onConversationDrawerOpen(id) {
      this.drawerConversationId = id;
    },
    onConversationDrawerClose() {
      this.drawerConversationId = null;
    },
  },
};
</script>

<style></style>
