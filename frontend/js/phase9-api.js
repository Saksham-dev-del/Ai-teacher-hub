async function p9json(url,options={},fallback='Request failed.'){const resp=await authFetch(url,options);const data=await resp.json().catch(()=>({}));if(!resp.ok)throw new Error(data.error||fallback);return data;}
const apiP9Workload=()=>p9json('/api/collaboration/workload');
const apiP9Departments=()=>p9json('/api/collaboration/departments');
const apiP9CreateDepartment=(p)=>p9json('/api/collaboration/departments',{method:'POST',body:JSON.stringify(p)});
const apiP9AddMember=(id,p)=>p9json(`/api/collaboration/departments/${id}/members`,{method:'POST',body:JSON.stringify(p)});
const apiP9DepartmentDashboard=(id)=>p9json(`/api/collaboration/department/${id}/dashboard`);
const apiP9AssignDepartment=(id,p)=>p9json(`/api/collaboration/resources/${id}/department`,{method:'PATCH',body:JSON.stringify(p)});
const apiP9Comments=(id)=>p9json(`/api/collaboration/resources/${id}/comments`);
const apiP9AddComment=(id,p)=>p9json(`/api/collaboration/resources/${id}/comments`,{method:'POST',body:JSON.stringify(p)});
const apiP9Versions=(id)=>p9json(`/api/collaboration/resources/${id}/versions`);
const apiP9CreateVersion=(id,p)=>p9json(`/api/collaboration/resources/${id}/versions`,{method:'POST',body:JSON.stringify(p)});
const apiP9RestoreVersion=(id,v)=>p9json(`/api/collaboration/resources/${id}/versions/${v}/restore`,{method:'POST',body:'{}'});
const apiP9Workflow=(id,p)=>p9json(`/api/collaboration/resources/${id}/workflow`,{method:'POST',body:JSON.stringify(p)});
const apiP9Rate=(id,p)=>p9json(`/api/collaboration/resources/${id}/rating`,{method:'POST',body:JSON.stringify(p)});
const apiP9Share=(id,p={})=>p9json(`/api/collaboration/resources/${id}/share-link`,{method:'POST',body:JSON.stringify(p)});
const apiP9ReviewQueue=()=>p9json('/api/collaboration/review-queue');
