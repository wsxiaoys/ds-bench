import { Router } from "@trpc/server";
import { TrpcPanelExtraOptions } from "./parse/parseRouter";
export type RenderOptions = {
    url: string;
    cache?: boolean;
} & TrpcPanelExtraOptions;
export declare function renderTrpcPanel(router: Router<any>, options: RenderOptions): string;
