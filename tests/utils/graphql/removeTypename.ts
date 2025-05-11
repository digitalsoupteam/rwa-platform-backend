// Helper function to remove __typename fields
export function removeTypename(obj: any): any {
    if (obj === null || obj === undefined || typeof obj !== 'object') 
      return obj;
    
    if (Array.isArray(obj)) 
      return obj.map(removeTypename);
    
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
      if (key !== '__typename') {
        newObj[key] = removeTypename(obj[key]);
      }
    });
    
    return newObj;
  }