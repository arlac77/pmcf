import { familyIP } from "ip-utilties";

export class Endpoint {
  constructor(service, networkInterface, data) {
    this.service = service;
    this.networkInterface = networkInterface;
    Object.assign(this, data);
  }

  toString() {
    return `${this.address}[${this.port}]`;
  }

  get socketAddress() {
    return `${this.address}:${this.port}`;
  }

  get hostName() {
    return this.networkInterface.hostName;
  }

  #address;

  get address() {
    return this.#address ?? this.networkInterface.address;
  }

  set address(value) {
    this.#address = value;
  }

  get family() {
    return familyIP(this.address);
  }
}
