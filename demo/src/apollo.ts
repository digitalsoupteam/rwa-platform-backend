import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Создаем базовый http линк
const httpLink = createHttpLink({
  uri: 'http://localhost:3000/graphql', // URL вашего GraphQL сервера
});

// Создаем auth линк для добавления токена
const authLink = setContext((_, { headers }) => {
  // Получаем токен из localStorage
  const token = localStorage.getItem('jwt');
  
  // Возвращаем заголовки с токеном
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// Создаем Apollo Client
export const client = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
});

// Функции для работы с токеном
export const saveToken = (token: string) => {
  localStorage.setItem('jwt', token);
};

export const getToken = () => {
  return localStorage.getItem('jwt');
};

export const removeToken = () => {
  localStorage.removeItem('jwt');
};
