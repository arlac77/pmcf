class BaseEndpoint {
  _type;

  constructor(service, data) {
    this.service = service;

    if (data.type !== undefined) {
      this._type = data.type;
    }
  }

  get type() {
    return this._type?.name ?? this.service.type;
  }

  get priority()
  {
    return this.service.priority;
  }

  toString() {
    return `${this.type}`;
  }
}

/**
 * Endpoint with an ip port
 */
class PortEndpoint extends BaseEndpoint {
  _port;
  constructor(service, data) {
    super(service, data);

    if (data.port !== undefined) {
      this._port = data.port;
    }
    if (data.protocol !== undefined) {
      this.protocol = data.protocol;
    }
    if (data.tls !== undefined) {
      this.tls = data.tls;
    }
  }

  /**
   * @return {number}
   */
  get port() {
    return this._port ?? this.service.port;
  }

  /**
   * @return {string}
   */
  get socketAddress() {
    return `${this.address}:${this.port}`;
  }

  toString() {
    return `${this.type}:${this.family}/${this.address}[${this.port}]`;
  }
}

export class Endpoint extends PortEndpoint {
  constructor(service, networkAddress, data) {
    super(service, data);
    this.networkAddress = networkAddress;
  }

  get hostName() {
    return this.networkAddress.networkInterface.hostName;
  }

  get domainName() {
    return this.networkAddress.networkInterface.domainName;
  }

  get address() {
    return this.networkAddress.address;
  }

  get family() {
    return this.networkAddress.family;
  }

  get networkInterface() {
    return this.networkAddress.networkInterface;
  }
}

export class DomainNameEndpoint extends PortEndpoint {
  constructor(service, domainName, data) {
    super(service, data);
    this.domainName = domainName;
  }

  get networkInterface() {
    return {};
  }

  get family() {
    return "dns"; // TODO
  }

  get address() {
    return this.domainName;
  }

  get isPool() {
    return this.domainName.indexOf("pool") >= 0; // TODO
  }
}

/**
 * Endpoint based on http
 */
export class HTTPEndpoint extends BaseEndpoint {

  /**
   * 
   * @param {Service} service 
   * @param {*} address 
   * @param {object} data 
   * @param {number} data.port
   * @param {string} data.pathname
   */
  constructor(service, address, data) {
    super(service, data);

    if (typeof address === "string") {
      this.url = new URL(address);
    } else if (address instanceof URL) {
      this.url = address;
    } else {
      this.family = address.family;
      this.url = new URL(
        (data.tls ? "https://" : "http://") +
          (address.family === "IPv6"
            ? "[" + address.address + "]"
            : address.address) +
          ":" +
          data.port +
          (data.pathname || "/")
      );
      this.hostname = address.address;
    }
  }

  /**
   * @return {number}
   */
  get port() {
    const port = this.url.port;
    if (port.length) {
      return parseInt(port);
    }
    return this.url.toString().startsWith("https:") ? 443 : 80;
  }

  get pathname() {
    return this.url.pathname;
  }

  get address() {
    return this.url;
  }

  get protocol() {
    return "tcp";
  }

  get tls() {
    return this.url.toString().startsWith("https:");
  }

  toString() {
    return `${this.type}:${this.url}`;
  }
}

export class UnixEndpoint extends BaseEndpoint {
  constructor(service, path, data) {
    super(service, data);
    this.path = path;
    this.scheme = data.scheme;
  }

  get family() {
    return "unix";
  }

  get host() {
    return this.service.host;
  }

  get address() {
    return this.path;
  }

  get url()
  {
    if(this.scheme) {
      return `${this.scheme}://${this.path}`;
    }
  }

  toString() {
    return `${this.type}:${this.family}:${this.path}`;
  }
}
