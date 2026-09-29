import api from '../../server/handlers/cms-content.js';
import { adapt } from '../../server/netlify-adapter.mjs';
export default adapt(api.handler);
