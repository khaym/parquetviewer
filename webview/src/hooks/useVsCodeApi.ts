import { useEffect, useRef, useCallback } from "react";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from "@shared/types";
import type { VsCodeApi } from "../types";

let vscodeApi: VsCodeApi | undefined;

function getVsCodeApi(): VsCodeApi {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

/**
 * Hook providing type-safe VS Code messaging.
 */
export function useVsCodeApi(
  onMessage: (message: ExtensionToWebviewMessage) => void,
) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      onMessageRef.current(event.data);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const postMessage = useCallback((message: WebviewToExtensionMessage) => {
    getVsCodeApi().postMessage(message);
  }, []);

  return { postMessage };
}
