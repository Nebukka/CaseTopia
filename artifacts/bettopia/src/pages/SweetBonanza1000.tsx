import React from "react";
import { Layout } from "../components/Layout";

export default function SweetBonanza1000() {
  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Sweet Bonanza 1000</h1>
          <p className="text-muted-foreground text-sm">Pragmatic Play · Slot · Demo</p>
        </div>
        <div
          className="w-full rounded-xl overflow-hidden border border-border bg-black"
          style={{ height: "calc(100vh - 180px)", minHeight: 520 }}
        >
          <iframe
            src="https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20sbn1000&lang=en&cur=DL&jurisdiction=MT"
            title="Sweet Bonanza 1000"
            className="w-full h-full"
            allow="fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </Layout>
  );
}
