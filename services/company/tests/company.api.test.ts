/**
 * Component tests for the company HTTP layer.
 *
 * The whole Elysia app is assembled in-process: real controllers and the real
 * CompanyService, with repositories replaced by in-memory fakes. Requests go
 * through app.handle() — no port is bound, nothing is queried over the network.
 * Run with `bun test` from services/company.
 */
import { beforeEach, describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { ErrorHandlerPlugin } from '@shared/errors/error-handler.plugin';
import { createServicesPlugin } from '../src/plugins/services.plugin';
import { createControllersPlugin } from '../src/plugins/controllers.plugin';
import type { RepositoriesPlugin } from '../src/plugins/repositories.plugin';
import { createFakeCompanyRepository, type FakeCompanyRepository } from './fakes/company.repository.fake';
import { createFakeMemberRepository, type FakeMemberRepository } from './fakes/members.repository.fake';
import { createFakePermissionRepository, type FakePermissionRepository } from './fakes/permissions.repository.fake';

const COMPANY = {
  name: 'Acme RWA',
  description: 'Tokenized real estate platform',
  ownerId: 'owner-1',
  country: 'US',
  socials: [{ type: 'website', url: 'https://acme.example' }],
};

function buildApp(
  companies: FakeCompanyRepository,
  members: FakeMemberRepository,
  permissions: FakePermissionRepository,
) {
  const repositoriesPlugin = new Elysia({ name: 'Repositories' })
    .decorate('companyRepository', companies)
    .decorate('memberRepository', members)
    .decorate('permissionRepository', permissions);

  const servicesPlugin = createServicesPlugin(repositoriesPlugin as unknown as RepositoriesPlugin);

  return new Elysia().onError(ErrorHandlerPlugin).use(createControllersPlugin(servicesPlugin));
}

type App = ReturnType<typeof buildApp>;

async function post(app: App, path: string, body: unknown) {
  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

  return { status: response.status, body: (await response.json()) as any };
}

describe('company HTTP layer (component, fake repositories)', () => {
  let companies: FakeCompanyRepository;
  let members: FakeMemberRepository;
  let permissions: FakePermissionRepository;
  let app: App;

  beforeEach(() => {
    companies = createFakeCompanyRepository();
    members = createFakeMemberRepository();
    permissions = createFakePermissionRepository();
    app = buildApp(companies, members, permissions);
  });

  test('createCompany → getCompany → getCompanies round-trip', async () => {
    const created = await post(app, '/createCompany', COMPANY);
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({ name: COMPANY.name, ownerId: COMPANY.ownerId, country: COMPANY.country });
    expect(typeof created.body.id).toBe('string');

    const fetched = await post(app, '/getCompany', { id: created.body.id });
    expect(fetched.status).toBe(200);
    expect(fetched.body.id).toBe(created.body.id);
    expect(fetched.body.name).toBe(COMPANY.name);
    expect(fetched.body.users).toEqual([]); // no members yet

    const list = await post(app, '/getCompanies', { filter: {} });
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0]).not.toHaveProperty('users'); // the list endpoint returns the basic shape only
  });

  test('createCompany: an invalid payload never reaches the repository', async () => {
    const response = await post(app, '/createCompany', { name: 'Missing everything else' });

    expect(response.status).not.toBe(200);
    expect(companies.create).toHaveBeenCalledTimes(0);
  });

  test('updateCompany: rename is visible through getCompany', async () => {
    const created = await post(app, '/createCompany', COMPANY);

    const updated = await post(app, '/updateCompany', { id: created.body.id, updateData: { name: 'Renamed' } });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toBe('Renamed');

    const fetched = await post(app, '/getCompany', { id: created.body.id });
    expect(fetched.body.name).toBe('Renamed');
  });

  test('getCompany: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/getCompany', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Company unknown-id not found' } });
  });

  test('deleteCompany: removes the company and cascades to members and permissions', async () => {
    const company = (await post(app, '/createCompany', COMPANY)).body;
    const member = (await post(app, '/addMember', { companyId: company.id, userId: 'user-1', name: 'Alice' })).body;
    await post(app, '/grantPermission', {
      companyId: company.id,
      memberId: member.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });

    const deleted = await post(app, '/deleteCompany', { id: company.id });
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ id: company.id });

    const list = await post(app, '/getCompanies', { filter: {} });
    expect(list.body).toHaveLength(0);
    expect(members.store.has(member.id)).toBe(false);
    expect(permissions.store.size).toBe(0);

    const fetched = await post(app, '/getCompany', { id: company.id });
    expect(fetched.status).toBe(404);
  });

  test('deleteCompany: an unknown id maps to 404 NOT_FOUND', async () => {
    const response = await post(app, '/deleteCompany', { id: 'unknown-id' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Company unknown-id not found' } });
  });

  test('members and permissions: addMember → grantPermission → getCompany groups permissions by user', async () => {
    const company = (await post(app, '/createCompany', COMPANY)).body;

    const member = await post(app, '/addMember', { companyId: company.id, userId: 'user-1', name: 'Alice' });
    expect(member.status).toBe(200);
    expect(member.body.companyId).toBe(company.id);

    const granted = await post(app, '/grantPermission', {
      companyId: company.id,
      memberId: member.body.id,
      userId: 'user-1',
      permission: 'admin',
      entity: 'company',
    });
    expect(granted.status).toBe(200);
    expect(granted.body.permission).toBe('admin');

    const fetched = await post(app, '/getCompany', { id: company.id });
    expect(fetched.body.users).toHaveLength(1);
    expect(fetched.body.users[0]).toMatchObject({ id: member.body.id, userId: 'user-1', name: 'Alice' });
    expect(fetched.body.users[0].permissions).toHaveLength(1);
    expect(fetched.body.users[0].permissions[0]).toMatchObject({ permission: 'admin', entity: 'company' });
  });

  test('removeMember and revokePermission: members and permissions are removed independently', async () => {
    const company = (await post(app, '/createCompany', COMPANY)).body;
    const alice = (await post(app, '/addMember', { companyId: company.id, userId: 'user-1', name: 'Alice' })).body;
    const bob = (await post(app, '/addMember', { companyId: company.id, userId: 'user-2', name: 'Bob' })).body;
    const alicePermission = (
      await post(app, '/grantPermission', {
        companyId: company.id,
        memberId: alice.id,
        userId: 'user-1',
        permission: 'admin',
        entity: 'company',
      })
    ).body;
    const bobPermission = (
      await post(app, '/grantPermission', {
        companyId: company.id,
        memberId: bob.id,
        userId: 'user-2',
        permission: 'read',
        entity: 'assets',
      })
    ).body;

    const removed = await post(app, '/removeMember', { id: alice.id });
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ id: alice.id });

    const afterRemoval = await post(app, '/getCompany', { id: company.id });
    expect(afterRemoval.body.users.map((u: any) => u.userId)).toEqual(['user-2']);
    expect(permissions.store.has(alicePermission.id)).toBe(false);
    expect(permissions.store.has(bobPermission.id)).toBe(true);

    const revoked = await post(app, '/revokePermission', { id: bobPermission.id });
    expect(revoked.status).toBe(200);
    expect(revoked.body).toEqual({ id: bobPermission.id });

    const afterRevoke = await post(app, '/getCompany', { id: company.id });
    expect(afterRevoke.body.users[0].permissions).toEqual([]);
  });

  test('getCompanies: filter is forwarded end-to-end', async () => {
    await post(app, '/createCompany', COMPANY);
    await post(app, '/createCompany', { ...COMPANY, name: 'Other', ownerId: 'owner-2' });

    const list = await post(app, '/getCompanies', { filter: { ownerId: 'owner-2' } });

    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].name).toBe('Other');
  });
});
