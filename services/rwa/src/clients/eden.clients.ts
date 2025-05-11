import { edenTreaty } from "@elysiajs/eden"
import { CONFIG } from "../config"
import {App as SignersManagerApp} from '@services/signers-manager/src'

export const signersManagerClient = edenTreaty<SignersManagerApp>(CONFIG.OTHER_SERVICES.SIGNATURES_MANAGER.URL)

export type SignersManagerClient = typeof signersManagerClient