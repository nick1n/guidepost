import "@unocss/reset/tailwind-v4.css";
import "../../../../src/app.css";
import { mount, unmount } from "svelte";
import Fixture from "./Fixture.svelte";
import { attempts, finish, notices } from "./kit.ts";

const target = document.querySelector("#app");
if (!target) throw new Error("Missing fixture mount point");
const instance = mount(Fixture, { target });
Object.assign(window, { retryTest: { attempts, finish, notices, unmount: () => unmount(instance) } });
