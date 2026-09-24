import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:4000/api'});
api.interceptors.request.use(config=>{const token=localStorage.getItem('edulead_token');if(token) config.headers.Authorization=`Bearer ${token}`;return config});
api.interceptors.response.use(r=>r,e=>{if(e.response?.status===401){localStorage.removeItem('edulead_token');localStorage.removeItem('edulead_user');window.location.href='/login'} return Promise.reject(e)});
export async function request<T>(
  promise: Promise<any>
): Promise<T> {
  const r = await promise;

  const body = r?.data?.success !== undefined ? r.data : r;

  if (!body.success) {
    throw new Error(body.error?.message || 'Request failed');
  }

  return body.data;
}
