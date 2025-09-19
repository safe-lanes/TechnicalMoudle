export interface TestUser {
  username: string;
  password: string;
  role: 'admin' | 'chief_engineer' | '2nd_engineer' | 'chief_officer';
  displayName: string;
}

export const TEST_USERS: Record<string, TestUser> = {
  admin: {
    username: 'admin_test',
    password: 'Admin123!',
    role: 'admin',
    displayName: 'Test Admin'
  },
  chiefEngineer: {
    username: 'chief_eng_test',
    password: 'Chief123!',
    role: 'chief_engineer',
    displayName: 'Chief Engineer Test'
  },
  secondEngineer: {
    username: '2nd_eng_test',
    password: 'Second123!',
    role: '2nd_engineer',
    displayName: '2nd Engineer Test'
  },
  chiefOfficer: {
    username: 'chief_officer_test',
    password: 'Officer123!',
    role: 'chief_officer',
    displayName: 'Chief Officer Test'
  }
};