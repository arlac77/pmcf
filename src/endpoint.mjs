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

  #address;

  get address() {
    return this.#address ?? this.networkAddress.address;
  }

  set address(value) {
    this.#address = value;
  }

  get family() {
    return this.networkAddress.family;
  }

  get networkInterface() {
    return this.networkAddress.networkInterface;
  }
}
