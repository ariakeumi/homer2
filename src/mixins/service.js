export default {
  props: {
    proxy: Object,
  },
  created: function () {
    // custom service often consume info from an API using the item link (url) as a base url,
    // but sometimes the base url is different. An optional alternative URL can be provided with the "endpoint" key.
    this.endpoint = this.item.endpoint || this.item.url;

    if (this.endpoint && this.endpoint.endsWith("/")) {
      this.endpoint = this.endpoint.slice(0, -1);
    }

    // Timer ids of the intervals started by this component, cleared on
    // unmount so a rebuilt card (search filter, page change) doesn't leave
    // zombie pollers running against a dead instance.
    this._intervals = [];
  },
  beforeUnmount: function () {
    this._intervals.forEach((id) => window.clearInterval(id));
    this._intervals = [];
  },
  methods: {
    // window.setInterval wrapper registering the timer for automatic
    // cleanup on unmount. Use this instead of the global setInterval.
    setInterval: function (callback, delay) {
      const id = window.setInterval(callback, delay);
      this._intervals.push(id);
      return id;
    },
    // Stops an interval previously started with this.setInterval before
    // unmount (unmount itself clears every remaining one automatically).
    clearInterval: function (id) {
      window.clearInterval(id);
      this._intervals = this._intervals.filter((stored) => stored !== id);
    },
    fetch: function (path, init, json = true) {
      let options = {};

      if (this.proxy?.useCredentials) {
        options.credentials = "include";
      }

      if (this.proxy?.headers && !!this.proxy.headers) {
        options.headers = this.proxy.headers;
      }

      // Each item can override the credential settings
      if (this.item.useCredentials !== undefined) {
        options.credentials =
          this.item.useCredentials === true ? "include" : "omit";
      }

      // Each item can have their own headers
      if (this.item.headers !== undefined && !!this.item.headers) {
        options.headers = this.item.headers;
      }

      options = Object.assign(options, init);

      if (path.startsWith("/")) {
        path = path.slice(1);
      }

      let url = this.endpoint;

      if (path) {
        url = `${this.endpoint}/${path}`;
      }

      return fetch(url, options).then((response) => {
        let success = response.ok;
        if (Array.isArray(this.item.successCodes)) {
          success = this.item.successCodes.includes(response.status);
        }

        if (!success) {
          throw new Error(
            `Fail to fetch ressource: (${response.status} error)`,
            { cause: response },
          );
        }

        return json ? response.json() : response.text();
      });
    },
  },
};
