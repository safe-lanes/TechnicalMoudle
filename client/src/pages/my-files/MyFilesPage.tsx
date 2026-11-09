import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useVessel } from "@/contexts/VesselContext";
import { getAccessToken } from "@/lib/authToken";

/**
 * My Files: the shared file module, loaded as one script from /mf/my-files/ on the SAILERP origin and mounted here
 * (its contract: my-files-app/src/microfrontend/index.tsx). The bundle reads nothing from browser storage: it gets
 * the SAILERP token, the module code and the vessel from us, and enforces permissions on the My Files server.
 */
const BUNDLE_URL = "/mf/my-files/my-files.js";
const MODULE_CODE = "Technical"; // exact sails auditmodules.shortname

interface MyFilesApi {
  mount(el: HTMLElement, options: Record<string, unknown>): void;
  unmount(el: HTMLElement): void;
}

let loading: Promise<MyFilesApi> | null = null;
function loadBundle(): Promise<MyFilesApi> {
  const existing = (window as unknown as { MyFilesMf?: MyFilesApi }).MyFilesMf;
  if (existing) return Promise.resolve(existing);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const fail = (message: string) => {
        loading = null;
        script.remove();
        reject(new Error(message));
      };
      const script = document.createElement("script");
      script.src = BUNDLE_URL;
      script.onload = () => {
        const api = (window as unknown as { MyFilesMf?: MyFilesApi }).MyFilesMf;
        if (api) resolve(api);
        else fail(`${BUNDLE_URL} did not define window.MyFilesMf`);
      };
      script.onerror = () => fail(`Could not load ${BUNDLE_URL}`);
      document.head.appendChild(script);
    });
  }
  return loading;
}

export default function MyFilesPage() {
  const host = useRef<HTMLDivElement>(null);
  const { vesselId: selected } = useVessel();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // 'all' and 'my' are the selector's sentinels: no single vessel, so My Files shows its own filter unset.
  const vesselId = selected && !["all", "my"].includes(selected) ? selected : null;

  useEffect(() => {
    let cancelled = false;
    let mounted: { api: MyFilesApi; el: HTMLElement } | null = null;
    loadBundle()
      .then((api) => {
        if (cancelled || !host.current) return;
        api.mount(host.current, {
          token: getAccessToken() ?? "",
          getToken: () => getAccessToken() ?? "",
          moduleCode: MODULE_CODE,
          vesselId,
          apiUrl: `${window.location.origin}/b/api/v1`,
          filesApiUrl: `${window.location.origin}/m/api/v1`,
        });
        mounted = { api, el: host.current };
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      mounted?.api.unmount(mounted.el);
    };
  }, [vesselId]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]" data-testid="my-files-error">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-700 mb-1">My Files could not be loaded</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full" data-testid="my-files-page">
      {!ready && <Loader2 className="h-6 w-6 animate-spin text-gray-400 m-6" />}
      <div ref={host} />
    </div>
  );
}
