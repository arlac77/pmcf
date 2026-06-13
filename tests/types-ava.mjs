import test from "ava";
import { types, resolveTypeLinks } from "pacc";
import {
  Base,
  Cluster,
  Root,
  Host,
  Location,
  Network,
  Service,
  ExtraSourceService,
  Subnet,
  Owner,
  BindService,
  ChronyService,
  ALPMService
} from "pmcf";

test("types", t => {
  resolveTypeLinks();
  t.is(types.base, Base);
  t.is(types.base.extends, undefined);
  t.is(types.root, Root);
  t.is(types.root.extends, Location);
  t.is(types.location, Location);
  t.is(types.location.extends, Owner);
  t.deepEqual(types.location.owners, [types.owner, types.location, types.root]);

  t.is(types.network, Network);
  t.is(types.network.extends, Owner);
  t.is(types.subnet, Subnet);
  t.is(types.subnet.extends, Base);
  t.is(types.subnet.key, "address");

  t.is(types.service, Service);
  t.is(types.service.extends, Base);

  /*
  t.deepEqual(types.service.owners, [
    types.host,
    types.cluster,
    types.network_interface
  ]);
  */
  t.is(types.host, Host);
  t.deepEqual(types.host.owners, [types.owner, types.network, types.root]);

  t.is(types.bind, BindService);
  t.is(types.bind.extends, ExtraSourceService);

  t.is(types.chrony, ChronyService);
  t.is(types.chrony.extends, ExtraSourceService);

  t.is(types.alpm, ALPMService);
  t.is(types.alpm.extends, Service);

  t.is(types.cluster, Cluster);
  t.is(types.cluster.extends, Host);
  t.is(types.owner, Owner);

  t.deepEqual(types.owner.attributes.hosts.type, types.host);
  t.deepEqual(types.owner.attributes.networks.type, types.network);

  t.deepEqual(types.owner.extends, types.base);
  t.deepEqual(types.owner.key, "name");
  t.deepEqual(types.service.extends, types.base);
  t.deepEqual(types.host.extends, types["service-owner"]);

  //console.log("CLUSTER EXT", types.cluster.extends.name, types.host.name);
  //t.is(types.cluster.extends, types.host);

  t.is(types.loopback.extends, types.SkeletonNetworkInterface);
});
