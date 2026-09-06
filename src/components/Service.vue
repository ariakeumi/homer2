<template>
  <Generic v-if="isGeneric" :item="item"></Generic>
  <component
    :is="component"
    v-else
    :key="instanceKey"
    :item="item"
    :proxy="proxy"
  ></component>
</template>

<script>
import { defineAsyncComponent } from "vue";
import errorComponent from "./services/_error.vue";
const defaultService = "Generic";

// Cache async component definitions per service type. Creating a new
// definition on every computed evaluation makes Vue treat re-rendered cards
// as brand new components and tear down / rebuild whole subtrees.
const componentCache = new Map();

// Stable identity per item object: when a card slot is reused for another
// item object (config reload, filtered results), the service component must
// remount so created() re-runs (endpoint, initial fetch).
const itemIds = new WeakMap();
let nextItemId = 0;

export default {
  name: "Service",
  props: {
    item: Object,
    proxy: Object,
  },
  computed: {
    isGeneric() {
      return defaultService === (this.item.type || defaultService);
    },
    component() {
      const type = this.item.type;
      if (!componentCache.has(type)) {
        componentCache.set(
          type,
          defineAsyncComponent({
            loader: () => import(`./services/${type}.vue`),
            errorComponent: errorComponent,
            timeout: 3000,
          }),
        );
      }
      return componentCache.get(type);
    },
    instanceKey() {
      if (!itemIds.has(this.item)) {
        itemIds.set(this.item, nextItemId);
        nextItemId += 1;
      }
      return itemIds.get(this.item);
    },
  },
};
</script>
