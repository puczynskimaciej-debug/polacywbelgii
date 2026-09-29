import api from '../../server/handlers/cms-auth.js';
import { adapt } from '../../server/netlify-adapter.mjs';
export default adapt(api.handler);
