class BaseEndpoint {
  _type;

  constructor(service, data) {
    this.service = service;

    if (data.type !== undefined) {
      this._type = data.type;
    }
  }

  get type() {
    return this._type ?? this.service.type;
  }

  toString() {
    return `${this.type}`;
  }
}

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

  get port() {
    return this._port ?? this.service.port;
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

  get socketAddress() {
    return `${this.address}:${this.port}`;
  }

  get hostName() {
    return this.networkAddress.networkInterface.hostName;
  }

  get domainName() {
    return this.networkAddress.networkInterface.domainName;
  }

  get address() {
    return this.networkAddress?.address;
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

  get address() {
    return this.domainName;
  }
}

export class HTTPEndpoint extends PortEndpoint {
  constructor(service, address, data) {
    super(service, data);

    if (typeof address === "string") {
      this.url = new URL(address);
    } else if (address instanceof URL) {
      this.url = address;
    } else {
      this.url = new URL(
        "http://" +
          (address.family === "IPv6"
            ? "[" + address.address + "]"
            : address.address) +
          ":" +
          data.port +
          data.path
      );
      this.hostname = address.address;
    }
  }

  get port() {
    return this.url.port || 80;
  }

  get pathname() {
    return this.url.pathname;
  }

  get address() {
    return this.url;
  }

  toString() {
    return `${this.type}:${this.url}`;
  }
}

export class UnixEndpoint extends BaseEndpoint {
  constructor(service, path, data) {
    super(service, data);
    this.path = path;
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

  toString() {
    return `${this.type}:${this.family}:${this.path}`;
  }
}
