<template>
  <div class="flex -m-5">
    <div
      class="flex-grow overflow-auto"
      :style="{
        height: showBanner
          ? 'calc(100vh - 3.5rem)'
          : '100vh',
      }"
      @scroll="handleScroll($event)"
    >
      <div class="flex justify-center">
        <div class="home-content px-8">
          <div
            class="py-8 -mx-4 px-4 sticky -top-6 bg-gray-50 z-20"
          >
            <h4
              class="leading-8 font-semibold transition-all duration-100"
              :class="scrolled ? 'text-base' : 'text-xl'"
            >
              {{ currentTenant.name }} team overview
            </h4>
          </div>

          <div
            class="mb-8 -mx-4 px-4 sticky top-12 bg-gray-50 z-20"
          >
            <app-dashboard-filters class="block" />
          </div>

          <app-dashboard-members class="mb-8" />
          <app-dashboard-organizations class="mb-8" />
          <app-dashboard-activities class="mb-8" />
        </div>
      </div>
    </div>
    <aside
      class="border-l border-gray-200 overflow-auto px-5 py-6"
      :style="{
        height: showBanner
          ? 'calc(100vh - 3.5rem)'
          : '100vh',
      }"
    >
      <app-dashboard-guides />
      <app-dashboard-integrations class="mb-10" />
      <app-dashboard-task />
    </aside>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useStore } from 'vuex';
import AppDashboardIntegrations from '@/modules/dashboard/components/dashboard-active-integrations.vue';
import {
  mapGetters,
  mapActions,
} from '@/shared/vuex/vuex.helpers';
import AppDashboardGuides from '@/modules/dashboard/components/dashboard-guides.vue';
import AppDashboardActivities from '@/modules/dashboard/components/dashboard-activities.vue';
import AppDashboardMembers from '@/modules/dashboard/components/dashboard-members.vue';
import AppDashboardOrganizations from '@/modules/dashboard/components/dashboard-organizations.vue';
import AppDashboardTask from '@/modules/dashboard/components/dashboard-task.vue';
import AppDashboardFilters from '@/modules/dashboard/components/dashboard-filters.vue';

const { currentTenant } = mapGetters('auth');
const { doFetch } = mapActions('report');
const { reset } = mapActions('dashboard');
const { showBanner } = mapGetters('tenant');

const store = useStore();

const storeUnsubscribe = ref(null);
const scrolled = ref(false);
const handleScroll = (event) => {
  scrolled.value = event.target.scrollTop > 20;
};

onMounted(() => {
  window.analytics.page('Dashboard');
  doFetch({});

  storeUnsubscribe.value = store.subscribeAction(
    (action) => {
      if (action.type === 'auth/doSelectTenant') {
        doFetch({});
        reset({});
      }
    },
  );
});

onBeforeUnmount(() => {
  storeUnsubscribe.value();
});
</script>

<style lang="scss" scoped>
aside {
  width: 16.25rem;
  min-width: 16.25rem;
}
.home-content {
  max-width: 60rem;
  width: 100%;
}
</style>
