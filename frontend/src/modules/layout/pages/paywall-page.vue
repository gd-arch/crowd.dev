<template>
  <app-page-wrapper
    :container-class="'md:col-start-1 md:col-span-6 lg:col-start-2 lg:col-span-10'"
  >
    <div class="panel !p-8 !pb-16 paywall-page">
      <div class="flex justify-between">
        <div class="flex gap-4">
          <div
            class="h-12 w-12 flex items-center justify-center rounded-lg bg-brand-500"
          >
            <i
              class="text-white text-2xl"
              :class="page.icon"
            />
          </div>
          <div class="flex flex-col">
            <div class="text-2xs text-brand-500">
              {{ FeatureFlag.premiumFeatureCopy() }}
              feature
            </div>
            <h5 class="text-gray-900">
              {{ page.headerTitle }}
            </h5>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <div class="text-gray-500 italic text-2xs">
            Available in {{ computedFeaturePlan }}
          </div>
          <router-link
            :to="{
              name: 'settings',
              query: { activeTab: 'plans' },
            }"
          >
            <el-button class="btn btn--md btn--primary">
              Upgrade plan
            </el-button>
          </router-link>
        </div>
      </div>

      <el-divider class="!mt-8 !mb-11 border-gray-200" />

      <div class="grid grid-cols-10 gap-y-12">
        <div class="text-gray-900 col-start-2 col-span-8">
          <h4 class="mb-4">
            {{ page.title }}
          </h4>
          <div class="text-xs">
            {{ page.mainContent }}
          </div>
        </div>

        <div class="bg-image">
          <img
            alt="Paywall"
            class="w-9/12 mx-auto"
            :src="page.imageSrc"
            :class="page.imageClass"
          />
        </div>

        <div
          v-if="page.secondaryContent"
          class="text-gray-500 col-start-2 col-span-8 italic text-xs"
        >
          {{ page.secondaryContent }}
        </div>

        <div
          v-if="page.featuresList?.length"
          class="col-start-2 col-span-8"
        >
          <div
            v-for="(feature, index) of page.featuresList"
            :key="index"
            class="flex items-start mb-14"
          >
            <i
              class="text-brand-500 text-xl"
              :class="feature.icon"
            />
            <div class="ml-4 pt-1">
              <h6 class="mb-4">
                {{ feature.title }}
              </h6>
              <div class="text-xs text-gray-900">
                {{ feature.content }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </app-page-wrapper>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import config from '@/config';
import AppPageWrapper from '@/shared/layout/page-wrapper.vue';
import { pageContent } from '@/modules/layout/layout-page-content';
import { FeatureFlag } from '@/featureFlag';

const router = useRouter();

const section = computed(
  () => router.currentRoute.value.name,
);
const page = computed(() => pageContent[section.value]);
const computedFeaturePlan = computed(() => {
  if (config.isCommunityVersion) return 'Custom plan';
  if (page.value.headerTitle === 'Eagle Eye') return 'Growth and Eagle Eye plans';
  return 'Growth plan';
});
</script>

<style lang="scss">
.paywall-page {
  .bg-image {
    @apply col-start-1 col-span-10 rounded-md h-70 overflow-hidden;
    background: linear-gradient(
        279.88deg,
        rgba(233, 79, 46, 0.05) 0%,
        rgba(233, 79, 46, 0) 100%
      ),
      #f9fafb;
  }
}
</style>
