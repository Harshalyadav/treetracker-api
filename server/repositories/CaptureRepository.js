const BaseRepository = require('./BaseRepository');

class CaptureRepository extends BaseRepository {
  constructor(session) {
    super('capture', session);
    this._tableName = 'capture';
    this._session = session;
  }

  _filterWhereBuilder(object, builder) {
    const result = builder;
    const {
      parameters,
      whereNulls = [],
      whereNotNulls = [],
      whereIns = [],
    } = {
      ...object,
    };
    result.whereNot(`${this._tableName}.status`, 'deleted');
    whereNotNulls.forEach((whereNot) => {
      result.whereNotNull(whereNot);
    });

    whereNulls.forEach((whereNull) => {
      result.whereNull(whereNull);
    });

    whereIns.forEach((whereIn) => {
      result.whereIn(whereIn.field, whereIn.values);
    });

    const filterObject = { ...parameters };

    if (filterObject.organization_ids && filterObject.organization_ids.length) {
      const ids = [...filterObject.organization_ids];
      const knex = this._session.getDB();
      result.where((r) =>
        r
          .where(
            `id`,
            'in',
            knex.raw(`
              select tc.id from treetracker.capture tc
              join treetracker.grower_account tg on tc.grower_account_id = tg.id
              join planter p on p.id = tg.reference_id
              join stakeholder.stakeholder ss on ss.entity_id = p.organization_id
              where ss.id in (${ids.map((e) => `'${e}'`).join(',')})
            `),
          )
          .orWhereIn('planting_organization_id', ids),
      );
    }
    delete filterObject.organization_ids;

    if (
      filterObject.matchting_tree_distance ||
      filterObject.matchting_tree_time_range
    ) {
      const knex = this._session.getDB();
      result.where(`id`, 'in', knex.raw(`SELECT id FROM capture_tree_match`));
      delete filterObject.matchting_tree_distance;
      delete filterObject.matchting_tree_time_range;
    }

    if (filterObject.captured_at_start_date) {
      result.where(
        `${this._tableName}.captured_at`,
        '>=',
        `${filterObject.captured_at_start_date} 00:00`,
      );
      delete filterObject.captured_at_start_date;
    }
    if (filterObject.captured_at_end_date) {
      result.where(
        `${this._tableName}.captured_at`,
        '<=',
        `${filterObject.captured_at_end_date} 23:59:59`,
      );
      delete filterObject.captured_at_end_date;
    }

    result.where(filterObject);
  }

  async getByFilter(filterCriteria, options = {}) {
    const knex = this._session.getDB();

    let promise = knex
      .select(
        knex.raw(
          `
            id,
            reference_id,
            tree_id,
            planting_organization_id,
            device_configuration_id,
            image_url,
            lat,
            lon,
            status,
            grower_account_id,
            morphology,
            age,
            note,
            attributes,
            species_id,
            session_id,
            created_at,
            captured_at,
            t.tag_array
          FROM capture
          LEFT JOIN (
              SELECT ct.capture_id, array_agg(t.name) AS tag_array
              FROM capture_tag ct
              JOIN tag t ON t.id = ct.tag_id
              GROUP BY ct.capture_id
            ) t ON id = t.capture_id
        `,
        ),
      )
      .where((builder) => this._filterWhereBuilder(filterCriteria, builder));

    promise = promise.orderBy(
      filterCriteria?.sort?.order_by || 'created_at',
      filterCriteria?.sort?.order || 'desc',
    );

    const { limit, offset } = options;
    if (limit) {
      promise = promise.limit(limit);
    }
    if (offset) {
      promise = promise.offset(offset);
    }

    const captures = await promise;

    return captures;
  }

  async countByFilter(filter) {
    const { count } = await this._session
      .getDB()
      .count('*')
      .where((builder) => this._filterWhereBuilder(filter, builder))
      .from(this._tableName)
      .first();

    return Number(count);
  }
}

module.exports = CaptureRepository;
