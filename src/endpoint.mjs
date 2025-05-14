class BaseEndpoint {
  #type;

  constructor(service, data) {
    this.service = service;

    if (data.type !== undefined) {
      this.#type = data.type;
      delete data.type;
    }
  }

  get type() {
    return this.#type ?? this.service.type;
  }

  toString() {
    return `${this.type}`;
  }
}

class PortEndpoint extends BaseEndpoint {
  #port;
  constructor(service, data) {
    super(service, data);

    if (data.port !== undefined) {
      this.#port = data.port;
      delete data.port;
    }

    Object.assign(this, data);
  }

  get port() {
    return this.#port ?? this.service.port;
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
  constructor(service, url, data) {
    super(service, data);
    this.url = url;
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
