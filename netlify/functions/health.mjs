import api from '../../server/handlers/health.js';
import { adapt } from '../../server/netlify-adapter.mjs';
export default adapt(api.handler);
