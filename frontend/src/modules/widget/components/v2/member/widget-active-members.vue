<template>
  <div class="widget-active-members">
    <div class="grid grid-cols-3">
      <div
        v-for="(widget, index) of widgets"
        :key="index"
        class="p-6"
        :class="
          index !== 0
            ? 'border-l border-r border-gray-100'
            : ''
        "
      >
        <div class="flex items-center justify-between mb-4">
          <app-widget-title
            text-size="text-xs"
            :title="widget.title"
          />
          <button
            v-if="currentUser"
            v-show="!isPublicView"
            type="button"
            class="btn btn-brand--transparent btn--sm"
            @click="handleDrawerOpen(widget)"
          >
            View
          </button>
        </div>

        <query-renderer
          v-if="cubejsApi"
          :cubejs-api="cubejsApi"
          :query="widget.query"
        >
          <template
            #default="{ resultSet, loading, error }"
          >
            <!-- Loading -->
            <app-widget-loading
              v-if="loading || !resultSet?.loadResponses"
              type="kpi"
            />

            <!-- Error -->
            <app-widget-error
              v-else-if="error"
              type="kpi"
            />

            <app-widget-kpi
              v-else
              :current-value="kpiCurrentValue(resultSet)"
              :previous-value="kpiPreviousValue(resultSet)"
              :vs-label="`vs. last ${widget.period}`"
            />
          </template>
        </query-renderer>
      </div>
    </div>
    <app-widget-drawer
      v-if="drawerExpanded"
      v-model="drawerExpanded"
      :fetch-fn="getActiveMembers"
      :title="drawerTitle"
      :export-by-ids="true"
      :template="MEMBERS_REPORT.nameAsId"
      size="480px"
      @on-export="onExport"
    />
  </div>
</template>

<script setup>
import { computed, ref, defineProps } from 'vue';
import { QueryRenderer } from '@cubejs-client/vue3';
import moment from 'moment';
import {
  mapGetters,
  mapActions,
} from '@/shared/vuex/vuex.helpers';
import { TOTAL_ACTIVE_MEMBERS_QUERY } from '@/modules/widget/widget-queries';
import AppWidgetKpi from '@/modules/widget/components/v2/shared/widget-kpi.vue';
import AppWidgetTitle from '@/modules/widget/components/v2/shared/widget-title.vue';
import AppWidgetLoading from '@/modules/widget/components/v2/shared/widget-loading.vue';
import AppWidgetError from '@/modules/widget/components/v2/shared/widget-error.vue';
import AppWidgetDrawer from '@/modules/widget/components/v2/shared/widget-drawer.vue';
import {
  ONE_DAY_PERIOD_FILTER,
  FOURTEEN_DAYS_PERIOD_FILTER,
  THIRTY_DAYS_PERIOD_FILTER,
  DAILY_GRANULARITY_FILTER,
  WEEKLY_GRANULARITY_FILTER,
  MONTHLY_GRANULARITY_FILTER,
} from '@/modules/widget/widget-constants';
import { MemberService } from '@/modules/member/member-service';
import { MEMBERS_REPORT } from '@/modules/report/templates/template-reports';

const props = defineProps({
  filters: {
    type: Object,
    default: null,
  },
  isPublicView: {
    type: Boolean,
    default: false,
  },
});

const { currentUser } = mapGetters('auth');
const { cubejsApi } = mapGetters('widget');
const { doExport } = mapActions('member');

const drawerExpanded = ref();
const drawerTitle = ref();
const drawerGranularity = ref();

const query = (period, granularity) => TOTAL_ACTIVE_MEMBERS_QUERY({
  period,
  granularity,
  selectedPlatforms: props.filters.platform.value,
  selectedHasTeamMembers: props.filters.teamMembers,
});

const widgets = computed(() => [
  {
    title: 'Active members today',
    query: query(
      ONE_DAY_PERIOD_FILTER,
      DAILY_GRANULARITY_FILTER,
    ),
    period: 'day',
  },
  {
    title: 'Active members this week',
    query: query(
      FOURTEEN_DAYS_PERIOD_FILTER,
      WEEKLY_GRANULARITY_FILTER,
    ),
    period: 'week',
  },
  {
    title: 'Active members this month',
    query: query(
      THIRTY_DAYS_PERIOD_FILTER,
      MONTHLY_GRANULARITY_FILTER,
    ),
    period: 'month',
  },
]);

const kpiCurrentValue = (resultSet) => {
  if (resultSet.loadResponses[0].data.length === 0) {
    // if we get an empty data points array from cube
    return 0;
  }
  const pivot = resultSet.chartPivot();
  return Number(pivot[pivot.length - 1]['Members.count']);
};

const kpiPreviousValue = (resultSet) => {
  if (resultSet.loadResponses[0].data.length === 0) {
    // if we get an empty data points array from cube
    return 0;
  }
  const pivot = resultSet.chartPivot();
  return Number(pivot[pivot.length - 2]['Members.count']);
};

// Fetch function to pass to detail drawer
const getActiveMembers = async ({ pagination }) => {
  const activityTimestampFrom = moment()
    .utc()
    .startOf(drawerGranularity.value);

  if (drawerGranularity.value === 'week') {
    activityTimestampFrom.add(1, 'day');
  }

  const res = await MemberService.listActive({
    platform: props.filters.platform.value,
    isTeamMember: props.filters.teamMembers,
    activityIsContribution: null,
    activityTimestampFrom,
    activityTimestampTo: moment().utc(),
    orderBy: 'activityCount_DESC',
    offset: !pagination.count
      ? (pagination.currentPage - 1) * pagination.pageSize
      : 0,
    limit: !pagination.count
      ? pagination.pageSize
      : pagination.count,
  });
  return res;
};

// Open drawer and set title and period
const handleDrawerOpen = async (widget) => {
  window.analytics.track('Open report drawer', {
    template: MEMBERS_REPORT.nameAsId,
    widget: widget.title,
    period: widget.period,
  });

  drawerExpanded.value = true;
  drawerTitle.value = widget.title;
  drawerGranularity.value = widget.period;
};

const onExport = async ({ ids, count }) => {
  try {
    await doExport({
      selected: true,
      customIds: ids,
      count,
    });
  } catch (error) {
    console.error(error);
  }
};
</script>

<style lang="scss">
.widget-active-members {
  @apply bg-white shadow rounded-lg;
}
</style>
