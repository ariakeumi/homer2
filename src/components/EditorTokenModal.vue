<template>
  <div v-if="open" class="modal is-active">
    <div class="modal-background" @click="$emit('close')"></div>
    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Configuration Editor</p>
        <button
          class="delete"
          type="button"
          aria-label="Close"
          @click="$emit('close')"
        ></button>
      </header>
      <section class="modal-card-body">
        <div class="field">
          <label class="label" for="editor-modal-token">Editor token</label>
          <div class="control has-icons-right">
            <input
              id="editor-modal-token"
              ref="tokenInput"
              v-model="token"
              class="input"
              type="password"
              placeholder="Enter CONFIG_EDITOR_TOKEN"
              autocomplete="current-password"
              spellcheck="false"
              @keyup.enter="submit"
            />
            <span class="icon is-small is-right">
              <i class="fas fa-key"></i>
            </span>
          </div>
        </div>
      </section>
      <footer class="modal-card-foot">
        <button
          class="button is-primary"
          type="button"
          :disabled="!token"
          @click="submit"
        >
          Open editor
        </button>
        <button class="button is-light" type="button" @click="$emit('close')">
          Cancel
        </button>
      </footer>
    </div>
  </div>
</template>

<script>
export default {
  name: "EditorTokenModal",
  props: {
    open: {
      type: Boolean,
      default: false,
    },
    initialToken: {
      type: String,
      default: "",
    },
  },
  emits: ["close", "submit"],
  data: function () {
    return {
      token: "",
    };
  },
  watch: {
    open: function (open) {
      if (open) {
        this.token = this.initialToken;
        this.$nextTick(() => this.$refs.tokenInput?.focus());
      }
    },
  },
  mounted: function () {
    document.addEventListener("keydown", this.handleKeydown);
  },
  beforeUnmount: function () {
    document.removeEventListener("keydown", this.handleKeydown);
  },
  methods: {
    handleKeydown: function (event) {
      if (this.open && event.key === "Escape") {
        this.$emit("close");
      }
    },
    submit: function () {
      if (!this.token) {
        return;
      }
      this.$emit("submit", this.token);
    },
  },
};
</script>
