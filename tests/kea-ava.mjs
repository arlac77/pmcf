import test from "ava";
import { Root, Host, DHCPService, Endpoint, HTTPEndpoint } from "pmcf";

test("kea basics", t => {
  const owner = new Root("/");

  const h1 = new Host(owner, {
    name: "h1",
    networkInterfaces: {
     // l0: { kind: "loopback" },
      eth0: { ipAddresses: "10.0.0.1/16" }
    }
  });
  owner.addObject(h1);

  /*
  const la = h1.networkAddresses(
    na => na.networkInterface.kind === "loopback" && na.family === "IPv4"
  );
  */

  const a1 = [...h1.networkAddresses(
    na => na.family === "IPv4"
  )][0];

  const kea = new DHCPService(h1, {
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

  const result = kea.endpoints(e => e.family === "IPv4");

  const expected = [
        new Endpoint(kea, a1, {
          port: 547,
          protocol: "udp",
          tls: false
        }),
/*        new Endpoint(kea, a1, {
          type: "kea-ddns",
          port: 53001,
          protocol: "tcp",
          tls: false
        })*/
    /*
      .map(a => [
        new HTTPEndpoint(kea, a, {
          type: "kea-control-agent",
          port: 8000,
          tls: false
        }),
        new Endpoint(kea, a, {
          type: "kea-ddns",
          port: 53001,
          protocol: "tcp",
          tls: false
        })
      ])
      .flat()
      */
  ];
  //console.log([...la].map(a => a.toString()));
  //console.log(result.map(na => na.toString()));
  //console.log(expected.map(na => na.toString()));

  t.deepEqual(result, expected);
});
