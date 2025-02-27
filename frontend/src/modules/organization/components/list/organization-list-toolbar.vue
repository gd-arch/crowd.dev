<template>
  <div
    v-if="selectedRows.length > 0"
    class="app-list-table-bulk-actions"
  >
    <span class="block text-sm font-semibold mr-4">
      {{
        pluralize('organization', selectedRows.length, true)
      }}
      selected
    </span>

    <el-dropdown trigger="click" @command="handleCommand">
      <button type="button" class="btn btn--bordered btn--sm">
        <span class="mr-2">Actions</span>
        <i class="ri-xl ri-arrow-down-s-line" />
      </button>
      <template #dropdown>
        <el-dropdown-item :command="{ action: 'export' }">
          <i class="ri-lg ri-file-download-line mr-1" />
          Export to CSV
        </el-dropdown-item>

        <el-dropdown-item
          :command="{
            action: 'markAsTeamOrganization',
            value: markAsTeamOrganizationOptions.value,
          }"
          :disabled="
            isPermissionReadOnly
              || isEditLockedForSampleData
          "
        >
          <i
            class="ri-lg mr-1"
            :class="markAsTeamOrganizationOptions.icon"
          />
          {{ markAsTeamOrganizationOptions.copy }}
        </el-dropdown-item>

        <hr class="border-gray-200 my-1 mx-2" />

        <el-dropdown-item
          :command="{ action: 'destroyAll' }"
          :disabled="
            isPermissionReadOnly
              || isDeleteLockedForSampleData
          "
        >
          <div
            class="flex items-center"
            :class="{
              'text-red-500': !isDeleteLockedForSampleData,
            }"
          >
            <i class="ri-lg ri-delete-bin-line mr-2" />
            <span>Delete organizations</span>
          </div>
        </el-dropdown-item>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import pluralize from 'pluralize';
import { computed } from 'vue';
import {
  mapGetters,
  mapActions,
} from '@/shared/vuex/vuex.helpers';
import ConfirmDialog from '@/shared/dialog/confirm-dialog';
import Message from '@/shared/message/message';
import { OrganizationService } from '../../organization-service';
import { OrganizationPermissions } from '../../organization-permissions';

const { currentUser, currentTenant } = mapGetters('auth');
const { selectedRows, activeView } = mapGetters('organization');
const { doExport, doDestroyAll, doFetch } = mapActions('organization');

const isPermissionReadOnly = computed(
  () => new OrganizationPermissions(
    currentTenant.value,
    currentUser.value,
  ).edit === false,
);

const isEditLockedForSampleData = computed(
  () => new OrganizationPermissions(
    currentTenant.value,
    currentUser.value,
  ).editLockedForSampleData,
);
const isDeleteLockedForSampleData = computed(
  () => new OrganizationPermissions(
    currentTenant.value,
    currentUser.value,
  ).destroyLockedForSampleData,
);

const markAsTeamOrganizationOptions = computed(() => {
  const isTeamView = activeView.value.id === 'team';
  const organizationsCopy = pluralize(
    'organization',
    selectedRows.value.length,
    false,
  );

  if (isTeamView) {
    return {
      icon: 'ri-bookmark-2-line',
      copy: `Unmark as team ${organizationsCopy}`,
      value: false,
    };
  }

  return {
    icon: 'ri-bookmark-line',
    copy: `Mark as team ${organizationsCopy}`,
    value: true,
  };
});

const handleDoDestroyAllWithConfirm = async () => {
  try {
    await ConfirmDialog({
      type: 'danger',
      title: 'Delete organizations',
      message:
        "Are you sure you want to proceed? You can't undo this action",
      confirmButtonText: 'Confirm',
      cancelButtonText: 'Cancel',
      icon: 'ri-delete-bin-line',
    });

    await doDestroyAll(
      selectedRows.value.map((item) => item.id),
    );
  } catch (error) {
    console.error(error);
  }
};

const handleDoExport = async () => {
  try {
    await doExport();
  } catch (error) {
    console.error(error);
  }
};

const handleCommand = async (command) => {
  if (command.action === 'export') {
    await handleDoExport();
  } else if (command.action === 'destroyAll') {
    await handleDoDestroyAllWithConfirm();
  } else if (command.action === 'markAsTeamOrganization') {
    Promise.all(
      selectedRows.value.map((row) => OrganizationService.update(row.id, {
        isTeamOrganization: command.value,
      })),
    ).then(() => {
      Message.success(
        `${pluralize(
          'Organization',
          selectedRows.length,
          false,
        )} updated successfully`,
      );

      doFetch({
        keepPagination: true,
      });
    });
  }
};
</script>

<script>
export default {
  name: 'AppOrganizationListToolbar',
};
</script>
