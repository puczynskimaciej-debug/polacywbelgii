import api from '../../server/handlers/ads.js';
import { adapt } from '../../server/netlify-adapter.mjs';
export default adapt(api.handler);
