import test from "ava";
import { FAMILY_IPV4, FAMILY_IPV6 } from "ip-utilties";
import {
  InitializationContext,
  Host,
  Owner,
  kea,
  ServiceOwner,
  Endpoint,
  HTTPEndpoint,
  sortByFamilyAndAddress,
  assign
} from "pmcf";

test("kea basics", t => {
  const ic = new InitializationContext();
  const owner = ic.root;

  const linux = new Host();
  ic.read(linux, {
    name: "linux",
    os: "linux",
    networkInterfaces: {
      lo: {
        kind: "loopback"
      }
    }
  });
  assign(Owner.attributes.hosts, owner, linux);

  const h1 = new Host();
  ic.read(h1, {
    extends: [linux],
    name: "h1",
    networkInterfaces: {
      eth0: { ipAddresses: "10.0.0.1/16" }
    }
  });
  assign(Owner.attributes.hosts, owner, h1);

  /*const la = h1.networkAddresses(
    na => na.networkInterface.kind === "loopback" && na.family === FAMILY_IPV4
  );*/

  // console.log(h1.networkInterfaces, [...la].map(l=>l.toString()));

  const keaInst = new kea();
  ic.read(keaInst, {
    name: "kea",
    subsystems: {
      "kea-control-agent": {
        port: 8000
      },
      "kea-ddns": {
        port: 53001
      }
    }
  });

  assign(ServiceOwner.attributes.services, h1, keaInst);

  // h1.services = keaInst;

  t.is(keaInst.endpoint("dhcp").toString(), "dhcp:IPv4/10.0.0.1[547]");
  t.is(
    keaInst.endpoint("kea-ddns").toString(),
    "kea-ddns:IPv4/127.0.0.1[53001]"
  );
  t.is(
    keaInst.endpoint("kea-control-dhcp4").toString(),
    "kea-control-dhcp4:unix:/run/kea/ctrl-4"
  );
  t.is(
    keaInst.endpoint("kea-control-dhcp6").toString(),
    "kea-control-dhcp6:unix:/run/kea/ctrl-6"
  );

  /*
  const a1 = [...h1.networkAddresses(na => na.family === FAMILY_IPV4)][0];

  const result = kea
    .endpoints(e => e.family === FAMILY_IPV4)
    .sort(sortByFamilyAndAddress);

  let expected = [
    new HTTPEndpoint(kea, a1, {
      type: "kea-control-agent",
      port: 53002,
      tls: false
    }),
    new Endpoint(kea, a1, {
      type: "dhcp",
      protocol: "udp",
      port: 547,
      tls: false
    })
  ];

   expected.push(
    new HTTPEndpoint(kea, a1, {
      type: "kea-ha-4",
      port: 53003,
      tls: false
    })
  );
  
  expected = expected.sort(sortByFamilyAndAddress);

  //console.log([...la].map(a => a.toString()));
  console.log(result.map(na => na.toString()));
  console.log(expected.map(na => na.toString()));

  t.deepEqual(result, expected);
  */
});
