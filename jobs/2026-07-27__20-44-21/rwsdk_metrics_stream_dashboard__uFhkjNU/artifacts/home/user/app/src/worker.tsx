import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";
import { syncedStateRoutes, SyncedStateServer } from "rwsdk/use-synced-state/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { MetricsPage } from "@/app/pages/metrics";

export class MySyncedStateServer extends SyncedStateServer {
  storage!: any;

  override async setState(value: any, key: string) {
    await super.setState(value, key);
    
    if (key === "isRunning") {
      if (value === true) {
        const currentAlarm = await this.storage.getAlarm();
        if (!currentAlarm) {
          await this.storage.setAlarm(Date.now() + 1000);
        }
      } else {
        await this.storage.deleteAlarm();
      }
    }
  }

  async alarm() {
    const isRunning = await this.getState("isRunning");
    if (!isRunning) {
      return;
    }

    const ticks = (await this.getState("ticks")) as any[] || [];
    const tickCount = ((await this.getState("tickCount")) as number) || 0;
    const minVal = (await this.getState("minVal")) as number | null;
    const maxVal = (await this.getState("maxVal")) as number | null;
    const alertCount = ((await this.getState("alertCount")) as number) || 0;
    const threshold = (await this.getState("threshold")) as number | null;

    const nextSeq = tickCount + 1;
    const nextVal = Math.floor(Math.random() * 100) + 1;

    const isAlert = threshold !== null && threshold !== undefined && nextVal > threshold;

    const newTick = {
      seq: nextSeq,
      value: nextVal,
      isAlert,
    };

    const newTicks = [...ticks, newTick];
    if (newTicks.length > 100) {
      newTicks.shift();
    }

    const nextTickCount = nextSeq;
    const nextMinVal = minVal === null ? nextVal : Math.min(minVal, nextVal);
    const nextMaxVal = maxVal === null ? nextVal : Math.max(maxVal, nextVal);
    const nextAlertCount = isAlert ? alertCount + 1 : alertCount;

    await this.setState(newTicks, "ticks");
    await this.setState(nextTickCount, "tickCount");
    await this.setState(nextMinVal, "minVal");
    await this.setState(nextMaxVal, "maxVal");
    await this.setState(nextAlertCount, "alertCount");

    await this.storage.setAlarm(Date.now() + 1000);
  }
}

export { MySyncedStateServer as SyncedStateServer };

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ...syncedStateRoutes((env: any) => env.SYNCED_STATE_SERVER),
  render(Document, [
    route("/", Home),
    route("/metrics", MetricsPage),
  ]),
]);
