import test from "ava";
import { types, resolveTypeLinks } from "pacc";
import { network } from "../src/network.mjs";
import { host } from "../src/host.mjs";
import { root } from "../src/root.mjs";
import { cluster } from "../src/cluster.mjs";
import { base } from "../src/base.mjs";
import { core } from "../src/core.mjs";
import { Subnet } from "../src/subnet.mjs";
import { bind } from "../src/services/bind.mjs";
import { alpm } from "../src/services/alpm.mjs";
import { chrony } from "../src/services/chrony.mjs";
import { owner } from "../src/owner.mjs";
import { ServiceOwner } from "../src/service-owner.mjs";
import { Service } from "../src/service.mjs";
import { CoreService } from "../src/core-service.mjs";

test("types", t => {
  resolveTypeLinks();

  t.is(types.core.extends, undefined);

  t.is(types.base, base);
  t.is(types.base.extends, core);
  t.is(types.base.key, "name");

  t.is(types.owner, owner);
  t.is(types.owner.extends, ServiceOwner);
  t.is(types.owner.priority, 2);
  t.is(types.owner.key, "name");
  t.deepEqual(types.owner.owners, [types.owner, types.root]);
  t.deepEqual(types.owner.extends, types["service-owner"]);

  t.is(types.root, root);
  t.is(types.root.extends, owner);
  t.is(types.root.priority, 3);

  t.is(types.network, network);
  t.is(types.network.extends, owner);
  t.is(types.network.priority, 2);
  t.is(types.network.key, "name");

  t.is(types.subnet, Subnet);
  t.is(types.subnet.extends, core);
  t.is(types.subnet.priority, 1);
  t.is(types.subnet.key, "address");

  t.is(types.service, Service);
  t.is(types.service.extends, CoreService);
  t.deepEqual(types.service.extends, types["core-service"]);
  t.deepEqual(types.service.owners, [
    host,
    cluster,
    types["network_interface"]
  ]);
  t.is(types.service.priority, 1.1);
  t.is(types.service.key, "name");
  /*
  t.deepEqual(types.service.owners, [
    types.host,
    types.cluster,
    types.network_interface
  ]);
  */
  t.is(types.host, host);
  t.deepEqual(types.host.owners, [types.owner, types.network, types.root]);

  t.is(types.bind, bind);
  t.is(types.bind.extends, CoreService);
  t.is(types.bind.priority, 1.1);

  t.is(types.chrony, chrony);
  t.is(types.chrony.extends, CoreService);
  t.is(types.chrony.priority, 1.1);

  t.is(types.alpm, alpm);
  t.is(types.alpm.extends, CoreService);
  t.is(types.alpm.priority, 1.1);

  t.is(types.cluster, cluster);
  t.is(types.cluster.extends, host);
  t.is(types.cluster.priority, 1.5);

  t.deepEqual(types.owner.attributes.hosts.type, types.host);
  t.deepEqual(types.owner.attributes.networks.type, types.network);

  t.deepEqual(types.owner.key, "name");
  t.deepEqual(types.host.extends, types["service-owner"]);

  //console.log("CLUSTER EXT", types.cluster.extends.name, types.host.name);
  //t.is(types.cluster.extends, types.host);

  t.is(types.loopback.extends, types.SkeletonNetworkInterface);
});
