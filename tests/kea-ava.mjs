import test from "ava";
import {
  Root,
  Host,
  KeaService,
  Endpoint,
  HTTPEndpoint,
  fetureHasHTTPEndpoints,
  sortByFamilyAndAddress
} from "pmcf";

test("kea basics", t => {
  const owner = new Root("/");

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
      eth0: { ipAddresses: "10.0.0.1/16" }
    }
  });
  owner.addObject(h1);

  /*
  const la = h1.networkAddresses(
    na => na.networkInterface.kind === "loopback" && na.family === "IPv4"
  );
  */

  const kea = new KeaService(h1, {
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

  h1.services = kea;

  t.is(kea.endpoint("dhcp").toString(), "dhcp:IPv4/10.0.0.1[547]");
  t.is(kea.endpoint("kea-ddns").toString(), "kea-ddns:dns/h1[53001]");
  t.is(kea.endpoint("kea-control-dhcp4").toString(), "kea-control-dhcp4:unix:/run/kea/ctrl-4");
  t.is(kea.endpoint("kea-control-dhcp6").toString(), "kea-control-dhcp6:unix:/run/kea/ctrl-6");

  /*
  const a1 = [...h1.networkAddresses(na => na.family === "IPv4")][0];

  const result = kea
    .endpoints(e => e.family === "IPv4")
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

  if (fetureHasHTTPEndpoints) {
    expected.push(
      new HTTPEndpoint(kea, a1, {
        type: "kea-ha-4",
        port: 53003,
        tls: false
      })
    );
  }

  expected = expected.sort(sortByFamilyAndAddress);

  //console.log([...la].map(a => a.toString()));
  console.log(result.map(na => na.toString()));
  console.log(expected.map(na => na.toString()));

  t.deepEqual(result, expected);
  */
});
