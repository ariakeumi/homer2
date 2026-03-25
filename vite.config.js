import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "url";
import fs from "fs";
import path from "path";
import process from "process";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { version } from "./package.json";

function writeVersionPlugin() {
  return {
    name: "write-version",
    closeBundle() {
      fs.writeFileSync("dist/VERSION", version);
    },
  };
}

const configEditorFilePattern = /^[A-Za-z0-9][A-Za-z0-9._-]*\.yml$/;

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body, template = false) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (template) {
    res.setHeader("X-Homer-Config-Template", "1");
  }
  res.end(body);
}

async function handleConfigEditorRequest(req, res) {
  const token = process.env.CONFIG_EDITOR_TOKEN;
  if (!token) {
    sendJson(res, 403, {
      error: "Config editor is disabled on this server. Set CONFIG_EDITOR_TOKEN to enable it.",
    });
    return;
  }

  if (req.headers["x-homer-config-token"] !== token) {
    sendJson(res, 401, {
      error: "Missing or invalid editor token.",
    });
    return;
  }

  const url = new URL(req.url, "http://localhost");
  const fileName = url.searchParams.get("file") || "config.yml";
  if (!configEditorFilePattern.test(fileName)) {
    sendJson(res, 400, {
      error: "Only .yml files inside assets/ can be edited.",
    });
    return;
  }

  const assetsDir = path.join(process.cwd(), "public", "assets");
  const targetFile = path.join(assetsDir, fileName);
  const templateFile = `${targetFile}.dist`;

  if (req.method === "GET") {
    if (fs.existsSync(targetFile)) {
      sendText(res, 200, fs.readFileSync(targetFile, "utf8"));
      return;
    }

    if (fs.existsSync(templateFile)) {
      sendText(res, 200, fs.readFileSync(templateFile, "utf8"), true);
      return;
    }

    sendJson(res, 404, {
      error: `No YAML file or template was found for ${fileName}.`,
    });
    return;
  }

  if (req.method === "PUT") {
    fs.mkdirSync(assetsDir, { recursive: true });
    const body = await readRequestBody(req);
    const tempFile = path.join(
      assetsDir,
      `.${fileName}.${Date.now().toString(36)}.tmp`,
    );

    fs.writeFileSync(tempFile, body, "utf8");
    fs.renameSync(tempFile, targetFile);
    res.statusCode = 204;
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Allow", "GET, PUT, OPTIONS");
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  sendJson(res, 405, {
    error: "Method not allowed.",
  });
}

// https://vitejs.dev/config/
export default defineConfig({
  base: "",
  build: {
    assetsDir: "resources",
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    writeVersionPlugin(),
    // Custom plugin to serve dummy-data JSON files without sourcemap injection
    {
      name: "dummy-data-json-handler",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith("/dummy-data/")) {
            // Remove query parameters from URL to get the actual file path
            const urlWithoutQuery = req.url.split("?")[0];
            const filePath = path.join(process.cwd(), urlWithoutQuery);

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.end(fs.readFileSync(filePath, "utf8"));
              return;
            }
          }
          next();
        });
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/config.cgi")) {
            next();
            return;
          }

          try {
            await handleConfigEditorRequest(req, res);
          } catch (error) {
            sendJson(res, 500, {
              error:
                error instanceof Error
                  ? error.message
                  : "Unexpected config editor error.",
            });
          }
        });
      },
    },
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      useCredentials: true,
      manifestFilename: "assets/manifest.json",
      manifest: {
        name: "Homer dashboard",
        short_name: "Homer",
        description: "Home Server Dashboard",
        theme_color: "#3367D6",
        start_url: "../",
        scope: "../",
        icons: [
          {
            src: "./icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "./icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        navigateFallback: null,
      },
    }),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./node_modules", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
      },
    },
  },
});
