<template>
  <div class="app-list-table not-clickable panel">
    <div class="-mx-6 -mt-6">
      <el-table
        ref="table"
        :loading="loading('table')"
        :data="rows"
        row-key="id"
        border
        :default-sort="{
          prop: 'lastActive',
          order: 'descending',
        }"
        :row-class-name="rowClass"
        @sort-change="doChangeSort"
      >
        <el-table-column label="Name">
          <template #default="scope">
            <div class="font-medium text-black">
              {{
                translate(
                  `entities.automation.triggers.${scope.row.trigger}`,
                )
              }}
            </div>
            <div class="text-gray-600">
              {{ scope.row.settings.url }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Created on" width="150">
          <template #default="scope">
            <el-tooltip
              :content="formattedDate(scope.row.createdAt)"
              placement="top"
            >
              {{ timeAgo(scope.row.createdAt) }}
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="Last execution" width="150">
          <template #default="scope">
            <el-tooltip
              :disabled="!scope.row.lastExecutionAt"
              :content="
                formattedDate(scope.row.lastExecutionAt)
              "
              placement="top"
            >
              {{
                scope.row.lastExecutionAt
                  ? timeAgo(scope.row.lastExecutionAt)
                  : '-'
              }}
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="Status" width="200">
          <template #default="scope">
            <app-automation-toggle :automation="scope.row" />
          </template>
        </el-table-column>
        <el-table-column label="" width="70">
          <template #default="scope">
            <div class="table-actions">
              <app-automation-dropdown
                :automation="scope.row"
                @open-executions-drawer="
                  $emit('openExecutionsDrawer', scope.row)
                "
                @open-edit-automation-drawer="
                  $emit(
                    'openEditAutomationDrawer',
                    scope.row,
                  )
                "
              />
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import moment from 'moment';
import { mapGetters, mapActions } from 'vuex';
import { AutomationPermissions } from '@/modules/automation/automation-permissions';
import { AutomationModel } from '@/modules/automation/automation-model';
import { i18n } from '@/i18n';
import { formatDateToTimeAgo } from '@/utils/date';
import AutomationDropdown from '../automation-dropdown.vue';
import AutomationToggle from '../automation-toggle.vue';

const { fields } = AutomationModel;

export default {
  name: 'AppAutomationListTable',
  components: {
    'app-automation-dropdown': AutomationDropdown,
    'app-automation-toggle': AutomationToggle,
  },
  emits: [
    'openExecutionsDrawer',
    'openEditAutomationDrawer',
  ],
  computed: {
    ...mapGetters({
      rows: 'automation/rows',
      loading: 'automation/loading',
      selectedRows: 'automation/selectedRows',
      currentUser: 'auth/currentUser',
      currentTenant: 'auth/currentTenant',
    }),

    hasPermissionToEdit() {
      return new AutomationPermissions(
        this.currentTenant,
        this.currentUser,
      ).edit;
    },

    hasPermissionToDestroy() {
      return new AutomationPermissions(
        this.currentTenant,
        this.currentUser,
      ).destroy;
    },

    fields() {
      return fields;
    },
  },
  mounted() {
    this.doMountTable(this.$refs.table);
  },
  methods: {
    ...mapActions({
      doChangeSort: 'automation/doChangeSort',
      doMountTable: 'automation/doMountTable',
    }),

    translate(key) {
      return i18n(key);
    },

    rowClass({ row }) {
      const isSelected = this.selectedRows.find((r) => r.id === row.id)
        !== undefined;
      return isSelected ? 'is-selected' : '';
    },
    timeAgo(date) {
      return formatDateToTimeAgo(date);
    },
    formattedDate(date) {
      return moment(date).format('YYYY-MM-DD HH:mm:ss');
    },
  },
};
</script>
