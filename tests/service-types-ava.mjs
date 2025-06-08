import test from "ava";
import { ServiceTypes, serviceTypeEndpoints } from "pmcf";

test("ServiceTypes registered", t => {
  t.truthy(ServiceTypes.dns);
  t.truthy(ServiceTypes.bind);
  t.truthy(ServiceTypes["bind-statistics"]);
  t.truthy(ServiceTypes.kea);
});

test("serviceTypeEndpoints dns", t => {
  t.deepEqual(serviceTypeEndpoints("dns"), [
    { type: "dns", family: "IPv4", port: 53, protocol: "udp", tls: false },
    { type: "dns", family: "IPv6", port: 53, protocol: "udp", tls: false }
  ]);
});

test("serviceTypeEndpoints bind", t => {
  t.deepEqual(serviceTypeEndpoints("bind"), [
    {
      type: "bind-statistics",
      family: "IPv4",
      port: 19521,
      protocol: "tcp",
      tls: false,
      kind: "loopback"
    },
    {
      type: "bind-rdnc",
      family: "IPv4",
      port: 953,
      protocol: "tcp",
      tls: false,
      kind: "loopback"
    },
    { type: "dns", family: "IPv4", port: 53, protocol: "udp", tls: false },
    { type: "dns", family: "IPv6", port: 53, protocol: "udp", tls: false }
  ]);
});
