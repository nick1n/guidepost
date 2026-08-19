import { init } from "@instantdb/svelte";
import schema from "../../instant.schema";

export const db = init({
  appId: import.meta.env.PUBLIC_INSTANT_APP_ID,
  schema,
});
