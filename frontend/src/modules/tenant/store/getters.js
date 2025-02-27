import sharedGetters from '@/shared/store/getters';
import { router } from '@/router';

export default {
  ...sharedGetters(),
  showSampleDataAlert: (
    _state,
    _getters,
    _rootState,
    rootGetters,
  ) => {
    const currentTenant = rootGetters['auth/currentTenant'];

    return currentTenant.hasSampleData;
  },

  showIntegrationsErrorAlert: (
    _state,
    _getters,
    _rootState,
    rootGetters,
  ) => {
    const integrationsWithErrors = rootGetters['integration/withErrors'];

    return (
      integrationsWithErrors.length > 0
      && router.currentRoute.value.name !== 'integration'
    );
  },

  showIntegrationsNoDataAlert: (
    _state,
    _getters,
    _rootState,
    rootGetters,
  ) => {
    const integrationsWithNoData = rootGetters['integration/withNoData'];

    return (
      integrationsWithNoData.length > 0
      && router.currentRoute.value.name !== 'integration'
    );
  },

  showIntegrationsInProgressAlert: (
    _state,
    _getters,
    _rootState,
    rootGetters,
  ) => {
    const integrationsInProgress = rootGetters['integration/inProgress'];

    return integrationsInProgress.length > 0;
  },

  showBanner: (_state, getters) => (
    getters.showSampleDataAlert
      || getters.showIntegrationsErrorAlert
      || getters.showIntegrationsNoDataAlert
      || getters.showIntegrationsInProgressAlert
  ),
};
