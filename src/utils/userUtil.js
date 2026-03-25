export const givePrivilegeUtil = (role) => {
  switch (role) {
    case "admin":
      return {
        masterUpdate: true,
      };
    case "user":
      return {
        masterUpdate: false,
      };
    default:
      return {
        masterUpdate: false,
      };
  }
};
