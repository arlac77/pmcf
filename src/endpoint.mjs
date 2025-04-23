class _Endpoint {
  #port;
  #type;
  constructor(service, data) {
    this.service = service;
    if (data.port) {
      this.#port = data.port;
      delete data.port;
    }

    if (data.type) {
      this.#type = data.type;
      delete data.type;
    }
    Object.assign(this, data);
  }

  get type() {
    return this.#type ?? this.service.type;
  }

  get port() {
    return this.#port ?? this.service._port;
  }

  toString() {
    return `${this.type}/${this.address}[${this.port}]`;
  }
}

export class Endpoint extends _Endpoint {
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
    return this.networkAddress.address;
  }

  get family() {
    return this.networkAddress.family;
  }

  get networkInterface() {
    return this.networkAddress.networkInterface;
  }
}

export class DomainNameEndpoint extends _Endpoint {
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

export class HTTPEndpoint extends _Endpoint {
  constructor(service, url, data) {
    super(service, data);
    this.url = url;
  }

  get address() {
    return this.url;
  }
}
