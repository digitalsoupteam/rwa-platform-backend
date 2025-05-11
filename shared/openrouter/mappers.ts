
export function snakeToCamelCase<T>(obj: any): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
  
    if (Array.isArray(obj)) {
      return obj.map(item => snakeToCamelCase(item)) as any;
    }
  
    const camelCaseObj: any = {};
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        
        
        camelCaseObj[camelKey] = snakeToCamelCase(obj[key]);
      }
    }
  
    return camelCaseObj as T;
  }
  
  export function camelToSnakeCase<T>(obj: any): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
  
    if (Array.isArray(obj)) {
      return obj.map(item => camelToSnakeCase(item)) as any;
    }
  
    const snakeCaseObj: any = {};
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        
        const snakeKey = key.replace(/([A-Z])/g, letter => `_${letter.toLowerCase()}`);
        
        
        snakeCaseObj[snakeKey] = camelToSnakeCase(obj[key]);
      }
    }
  
    return snakeCaseObj as T;
  }