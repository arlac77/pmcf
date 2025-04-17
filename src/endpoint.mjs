export class Endpoint {
  constructor(service, networkAddress, data) {
    this.service = service;
    this.networkAddress = networkAddress;
    Object.assign(this, data);
  }

  toString() {
    return `${this.address}[${this.port}]`;
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
