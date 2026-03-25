<template>
  <search class="search-bar">
    <form role="search">
      <label for="search" class="search-label"></label>
      <input
        id="search"
        ref="search"
        name="search"
        type="search"
        :value="value"
        @input.stop="search($event.target.value)"
        @keydown.enter.exact.prevent="open()"
        @keydown.alt.enter.prevent="open('_blank')"
      />
    </form>
  </search>
</template>

<script>
const additionalSearchHotkeys = ["f"];

export default {
  name: "SearchInput",
  props: {
    value: String,
    hotkey: {
      type: String,
      default: "/",
    },
  },
  emits: ["search-open", "search-focus", "search-cancel", "input"],
  mounted() {
    this._keyListener = (event) => {
      if (!this.matchesSearchHotkey(event)) {
        return;
      }

      if (this.hasFocus()) {
        return;
      }

      event.preventDefault();
      this.focus();
    };

    this._escapeListener = (event) => {
      if (event.key === "Escape") {
        this.cancel();
      }
    };
    document.addEventListener("keydown", this._keyListener);
    document.addEventListener("keydown", this._escapeListener);

    // fill search from get parameter.
    const search = new URLSearchParams(window.location.search).get("search");
    if (search) {
      this.$refs.search.value = search;
      this.search(search);
      this.focus();
    }
  },
  beforeUnmount() {
    document.removeEventListener("keydown", this._keyListener);
    document.removeEventListener("keydown", this._escapeListener);
  },
  methods: {
    matchesSearchHotkey: function (event) {
      const hotkeys = [this.hotkey, ...additionalSearchHotkeys]
        .filter(Boolean)
        .map((hotkey) => hotkey.toLowerCase());

      return hotkeys.includes(event.key.toLowerCase());
    },
    open: function (target = null) {
      if (!this.$refs.search.value) {
        return;
      }
      this.$emit("search-open", target);
    },
    focus: function () {
      this.$emit("search-focus");
      this.$nextTick(() => {
        this.$refs.search.focus();
      });
    },
    hasFocus: function () {
      return document.activeElement == this.$refs.search;
    },
    setSearchURL: function (value) {
      const url = new URL(window.location);
      if (value === "") {
        url.searchParams.delete("search");
      } else {
        url.searchParams.set("search", value);
      }
      window.history.replaceState("search", null, url);
    },
    cancel: function () {
      this.setSearchURL("");
      this.$refs.search.value = "";
      this.$refs.search.blur();
      this.$emit("search-cancel");
    },
    search: function (value) {
      this.setSearchURL(value);
      this.$emit("input", value.toLowerCase());
    },
  },
};
</script>

<style lang="scss" scoped></style>
