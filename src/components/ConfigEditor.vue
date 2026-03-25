<template>
  <div id="app" class="theme-default light page-editor config-editor-page">
    <section class="section">
      <div class="container is-max-desktop">
        <div class="editor-shell">
          <div class="editor-header">
            <div>
              <p class="eyebrow">Configuration Editor</p>
              <h1 class="title is-3">Edit server YAML</h1>
              <p class="subtitle is-6">
                Changes are written directly to the server-side
                <code>assets/</code> directory.
              </p>
            </div>
            <a class="button is-light" :href="dashboardUrl()">
              Back to dashboard
            </a>
          </div>

          <article
            v-if="message.text"
            class="message"
            :class="message.kind === 'error' ? 'is-danger' : 'is-info'"
          >
            <div class="message-body">{{ message.text }}</div>
          </article>

          <div class="field-grid">
            <div class="field">
              <label class="label" for="editor-file">YAML file</label>
              <div class="control">
                <input
                  id="editor-file"
                  v-model.trim="fileName"
                  class="input"
                  type="text"
                  placeholder="config.yml"
                  spellcheck="false"
                />
              </div>
              <p class="help">
                Edit <code>config.yml</code> or another <code>.yml</code> file
                in <code>assets/</code>.
              </p>
            </div>

            <div class="field">
              <label class="label" for="editor-token">Editor token</label>
              <div class="control has-icons-right">
                <input
                  id="editor-token"
                  v-model="token"
                  class="input"
                  type="password"
                  placeholder="Enter CONFIG_EDITOR_TOKEN"
                  autocomplete="current-password"
                  spellcheck="false"
                  @keyup.enter="loadConfig"
                />
                <span class="icon is-small is-right">
                  <i class="fas fa-key"></i>
                </span>
              </div>
              <p class="help">
                Stored only in this browser session.
              </p>
            </div>
          </div>

          <div class="toolbar">
            <button
              class="button is-light"
              :class="{ 'is-loading': loading }"
              :disabled="loading || !fileNameValid"
              @click="loadConfig"
            >
              Load
            </button>
            <button
              class="button is-primary"
              :class="{ 'is-loading': saving }"
              :disabled="!canSave"
              @click="saveConfig"
            >
              Save to server
            </button>
            <button
              class="button is-light"
              :disabled="saving || !dirty"
              @click="resetContent"
            >
              Reset changes
            </button>
            <button class="button is-ghost" @click="clearToken">
              Clear token
            </button>

            <span class="toolbar-status">
              <strong v-if="loadedFromTemplate">Template loaded</strong>
              <strong v-else-if="dirty">Unsaved changes</strong>
              <strong v-else-if="loadedContent">Saved</strong>
            </span>
          </div>

          <article v-if="!fileNameValid" class="message is-warning">
            <div class="message-body">
              File name must stay inside <code>assets/</code> and end with
              <code>.yml</code>.
            </div>
          </article>

          <article v-if="validationErrors.length" class="message is-warning">
            <div class="message-body">
              <p class="mb-2">YAML validation failed:</p>
              <ul>
                <li v-for="(error, index) in validationErrors" :key="index">
                  {{ error }}
                </li>
              </ul>
            </div>
          </article>

          <div class="editor-area">
            <textarea
              v-model="content"
              class="textarea editor-textarea"
              spellcheck="false"
              wrap="off"
              @input="validateContent"
            ></textarea>
          </div>

          <p class="editor-note">
            Comments and formatting are preserved because the editor saves the
            raw YAML text.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import { parseDocument } from "yaml";

const tokenStorageKey = "homer.configEditor.token";
const defaultFileName = "config.yml";
const fileNamePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.yml$/;

export default {
  name: "ConfigEditor",
  data: function () {
    return {
      fileName:
        new URLSearchParams(window.location.search).get("file") ||
        defaultFileName,
      token: sessionStorage.getItem(tokenStorageKey) || "",
      content: "",
      loadedContent: "",
      loadedFromTemplate: false,
      loading: false,
      saving: false,
      validationErrors: [],
      message: {
        kind: "info",
        text: "",
      },
    };
  },
  computed: {
    normalizedFileName: function () {
      return this.fileName || defaultFileName;
    },
    fileNameValid: function () {
      return fileNamePattern.test(this.normalizedFileName);
    },
    dirty: function () {
      return this.content !== this.loadedContent;
    },
    canSave: function () {
      return (
        !!this.token &&
        this.fileNameValid &&
        !this.loading &&
        !this.saving &&
        this.validationErrors.length === 0
      );
    },
  },
  created: function () {
    document.title = "Config Editor | Homer";
    this.validateContent();
    if (this.token) {
      this.loadConfig();
    }
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  },
  beforeUnmount: function () {
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  },
  methods: {
    dashboardUrl: function () {
      const url = new URL(window.location);
      url.searchParams.delete("editor");
      url.searchParams.delete("file");
      return `${url.pathname}${url.search}${url.hash}`;
    },
    appBasePath: function () {
      const pathname = window.location.pathname;
      if (pathname.endsWith("/")) {
        return pathname;
      }

      const lastSegment = pathname.split("/").pop() || "";
      return lastSegment.includes(".")
        ? pathname.replace(/[^/]+$/, "")
        : `${pathname}/`;
    },
    apiUrl: function () {
      const url = new URL(
        `${this.appBasePath()}api/config.cgi`,
        window.location.origin,
      );
      url.searchParams.set("file", this.normalizedFileName);
      return url.toString();
    },
    editorHeaders: function () {
      return {
        "X-Homer-Config-Token": this.token,
      };
    },
    syncLocation: function () {
      const url = new URL(window.location);
      url.searchParams.set("editor", "1");
      if (this.normalizedFileName === defaultFileName) {
        url.searchParams.delete("file");
      } else {
        url.searchParams.set("file", this.normalizedFileName);
      }
      window.history.replaceState(
        {},
        document.title,
        `${url.pathname}${url.search}`,
      );
    },
    setMessage: function (kind, text) {
      this.message.kind = kind;
      this.message.text = text;
    },
    rememberToken: function () {
      if (this.token) {
        sessionStorage.setItem(tokenStorageKey, this.token);
      } else {
        sessionStorage.removeItem(tokenStorageKey);
      }
    },
    readResponseText: async function (response) {
      const body = await response.text();
      try {
        const payload = JSON.parse(body);
        if (payload?.error) {
          return payload.error;
        }
      } catch {
        // Ignore non-JSON responses and fall back to raw text.
      }

      return body || `Request failed with status ${response.status}.`;
    },
    validateContent: function () {
      if (!this.content) {
        this.validationErrors = [];
        return;
      }

      const document = parseDocument(this.content, { merge: true });
      this.validationErrors = document.errors.map((error) => error.message);
    },
    handleBeforeUnload: function (event) {
      if (!this.dirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    },
    clearToken: function () {
      this.token = "";
      sessionStorage.removeItem(tokenStorageKey);
      this.setMessage(
        "info",
        "Editor token cleared from this browser session.",
      );
    },
    resetContent: function () {
      this.content = this.loadedContent;
      this.validateContent();
      this.setMessage("info", "Unsaved changes were discarded.");
    },
    loadConfig: async function () {
      if (!this.fileNameValid) {
        this.setMessage("error", "Choose a valid .yml file name first.");
        return;
      }

      if (!this.token) {
        this.setMessage("error", "Enter the editor token before loading.");
        return;
      }

      this.loading = true;
      this.setMessage("info", "");

      try {
        this.rememberToken();
        const response = await fetch(this.apiUrl(), {
          headers: this.editorHeaders(),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await this.readResponseText(response));
        }

        this.content = await response.text();
        this.loadedContent = this.content;
        this.loadedFromTemplate =
          response.headers.get("X-Homer-Config-Template") === "1";
        this.validateContent();
        this.syncLocation();
        this.setMessage(
          "info",
          this.loadedFromTemplate
            ? "No live file was found, so the matching template was loaded. Save to create the file on the server."
            : "Configuration loaded from the server.",
        );
      } catch (error) {
        this.setMessage(
          "error",
          error.message || "Failed to load the YAML file from the server.",
        );
      } finally {
        this.loading = false;
      }
    },
    saveConfig: async function () {
      this.validateContent();

      if (this.validationErrors.length) {
        this.setMessage(
          "error",
          "Fix the YAML validation errors before saving.",
        );
        return;
      }

      this.saving = true;
      this.setMessage("info", "");

      try {
        this.rememberToken();
        const response = await fetch(this.apiUrl(), {
          method: "PUT",
          headers: {
            ...this.editorHeaders(),
            "Content-Type": "text/plain; charset=utf-8",
          },
          body: this.content,
        });

        if (!response.ok) {
          throw new Error(await this.readResponseText(response));
        }

        this.loadedContent = this.content;
        this.loadedFromTemplate = false;
        this.syncLocation();
        this.setMessage("info", "Configuration saved to the server.");
      } catch (error) {
        this.setMessage(
          "error",
          error.message || "Failed to save the YAML file on the server.",
        );
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
.config-editor-page {
  min-height: 100vh;
}

.editor-shell {
  padding: 1.5rem;
  border-radius: 1.5rem;
  background: var(--card-background);
  box-shadow: 0 1.5rem 3rem -2rem rgba(0, 0, 0, 0.45);
}

.editor-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--highlight-primary);
}

.field-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin: 1.5rem 0 1rem;
}

.toolbar-status {
  margin-left: auto;
  color: var(--text-subtitle);
}

.editor-area {
  margin-top: 1rem;
}

.editor-textarea {
  min-height: 60vh;
  resize: vertical;
  border-radius: 1rem;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.95rem;
  line-height: 1.6;
}

.editor-note {
  margin-top: 0.75rem;
  color: var(--text-subtitle);
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .editor-shell {
    padding: 1rem;
    border-radius: 1rem;
  }

  .editor-header {
    flex-direction: column;
  }

  .toolbar-status {
    width: 100%;
    margin-left: 0;
  }
}
</style>
