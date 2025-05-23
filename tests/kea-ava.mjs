import test from "ava";
import {
  Root,
  Host,
  KeaService,
  Endpoint,
  HTTPEndpoint,
  fetureHasHTTPEndpoints
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

  const a1 = [...h1.networkAddresses(na => na.family === "IPv4")][0];

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

  const result = kea.endpoints(e => e.family === "IPv4");

  const expected = [
    new Endpoint(kea, a1, {
      protocol: "udp",
      port: 547,
      tls: false
    }),
    new HTTPEndpoint(kea, a1, {
      type: "kea-control-agent",
      port: 53002,
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

  //console.log([...la].map(a => a.toString()));
  //console.log(result.map(na => na.toString()));
  //console.log(expected.map(na => na.toString()));

  t.deepEqual(result, expected);
});
