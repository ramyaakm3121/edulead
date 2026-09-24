export type Role='ADMIN'|'MANAGER'|'COUNSELLOR';
export type LeadStatus='NEW'|'CONTACT_ATTEMPTED'|'CONTACTED'|'QUALIFIED'|'COUNSELLING_SCHEDULED'|'COUNSELLING_COMPLETED'|'APPLICATION_STARTED'|'APPLICATION_SUBMITTED'|'OFFER_MADE'|'ENROLLED'|'NURTURE'|'LOST'|'DUPLICATE'|'INVALID';
export type Priority='LOW'|'MEDIUM'|'HIGH';
export interface User {id:number;name:string;email:string;role:Role;isActive?:boolean}
export interface Course {id:number;name:string;code:string}
export interface Source {id:number;name:string}
export interface Activity {id:number;activityType:string;description?:string|null;oldStatus?:string|null;newStatus?:string|null;createdAt:string;creator?:User}
export interface FollowUp {id:number;actionType:string;dueAt:string;notes?:string|null;outcome?:string|null;status:'PENDING'|'COMPLETED'|'CANCELLED';completedAt?:string|null;assignee?:User}
export interface Lead {id:number;leadNumber:string;fullName:string;phone:string;email?:string|null;city?:string|null;course?:Course|null;courseId?:number|null;preferredIntake?:string|null;campus?:string|null;qualification?:string|null;source?:Source|null;sourceId?:number|null;campaignName?:string|null;assignedTo?:number|null;assignee?:User|null;status:LeadStatus;priority:Priority;lastContactedAt?:string|null;nextFollowUpAt?:string|null;nextAction?:string|null;convertedAt?:string|null;lostReason?:string|null;createdAt:string;updatedAt:string;activities?:Activity[];followUps?:FollowUp[]}
