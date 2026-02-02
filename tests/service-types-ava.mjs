import test from "ava";
import { ServiceTypes, serviceTypeEndpoints } from "pmcf";

test("ServiceTypes registered", t => {
  t.truthy(ServiceTypes.dns);
  t.truthy(ServiceTypes.bind);
  t.truthy(ServiceTypes["bind-statistics"]);
  t.truthy(ServiceTypes.kea);
});

test("serviceTypeEndpoints dns", t => {
  t.deepEqual(serviceTypeEndpoints(ServiceTypes.dns), [
    {
      type: ServiceTypes.dns,
      family: "IPv4",
      port: 53,
      protocol: "udp",
      tls: false
    },
    {
      type: ServiceTypes.dns,
      family: "IPv6",
      port: 53,
      protocol: "udp",
      tls: false
    }
  ]);
});

test.only("serviceTypeEndpoints bind", t => {
  t.deepEqual(serviceTypeEndpoints(ServiceTypes.bind), [
    {
      type: ServiceTypes["bind-statistics"],
      family: "IPv4",
      port: 19521,
      protocol: "tcp",
      pathname: "/",
      tls: false,
      kind: "loopback"
    },
    {
      type: ServiceTypes["bind-statistics"],
      family: "IPv6",
      port: 19521,
      protocol: "tcp",
      pathname: "/",
      tls: false,
      kind: "loopback"
    },
    {
      type: ServiceTypes["bind-rdnc"],
      family: "IPv4",
      port: 953,
      protocol: "tcp",
      tls: false,
      kind: "loopback"
    },
    {
      type: ServiceTypes.dns,
      family: "IPv4",
      port: 53,
      protocol: "udp",
      tls: false
    },
    {
      type: ServiceTypes.dns,
      family: "IPv6",
      port: 53,
      protocol: "udp",
      tls: false
    }
  ]);
});
