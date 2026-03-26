import { queryParams, type RouteQueryOptions, type RouteDefinition, type RouteFormDefinition, applyUrlDefaults } from './../../../wayfinder'
import detail from './detail'
/**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
export const index = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})

index.definition = {
    methods: ["get","head"],
    url: '/marketing/quotation',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
index.url = (options?: RouteQueryOptions) => {
    return index.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
index.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: index.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
index.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: index.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
    const indexForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: index.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
        indexForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\QuotationController::index
 * @see app/Http/Controllers/Marketing/QuotationController.php:12
 * @route '/marketing/quotation'
 */
        indexForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: index.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    index.form = indexForm
/**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
export const create = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})

create.definition = {
    methods: ["get","head"],
    url: '/marketing/quotation/create',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
create.url = (options?: RouteQueryOptions) => {
    return create.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
create.get = (options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: create.url(options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
create.head = (options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: create.url(options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
    const createForm = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: create.url(options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
        createForm.get = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url(options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\QuotationController::create
 * @see app/Http/Controllers/Marketing/QuotationController.php:58
 * @route '/marketing/quotation/create'
 */
        createForm.head = (options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: create.url({
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    create.form = createForm
/**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
export const edit = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})

edit.definition = {
    methods: ["get","head"],
    url: '/marketing/quotation/{noPenawaran}/edit',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
edit.url = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPenawaran: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPenawaran: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPenawaran: args.noPenawaran,
                }

    return edit.definition.url
            .replace('{noPenawaran}', parsedArgs.noPenawaran.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
edit.get = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: edit.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
edit.head = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: edit.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
    const editForm = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: edit.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
        editForm.get = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: edit.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\QuotationController::edit
 * @see app/Http/Controllers/Marketing/QuotationController.php:89
 * @route '/marketing/quotation/{noPenawaran}/edit'
 */
        editForm.head = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: edit.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    edit.form = editForm
/**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
export const print = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})

print.definition = {
    methods: ["get","head"],
    url: '/marketing/quotation/{noPenawaran}/print',
} satisfies RouteDefinition<["get","head"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
print.url = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPenawaran: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPenawaran: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPenawaran: args.noPenawaran,
                }

    return print.definition.url
            .replace('{noPenawaran}', parsedArgs.noPenawaran.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
print.get = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'get'> => ({
    url: print.url(args, options),
    method: 'get',
})
/**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
print.head = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'head'> => ({
    url: print.url(args, options),
    method: 'head',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
    const printForm = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
        action: print.url(args, options),
        method: 'get',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
        printForm.get = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, options),
            method: 'get',
        })
            /**
* @see \App\Http\Controllers\Marketing\QuotationController::print
 * @see app/Http/Controllers/Marketing/QuotationController.php:165
 * @route '/marketing/quotation/{noPenawaran}/print'
 */
        printForm.head = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'get'> => ({
            action: print.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'HEAD',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'get',
        })
    
    print.form = printForm
/**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:228
 * @route '/marketing/quotation/{noPenawaran}'
 */
export const update = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

update.definition = {
    methods: ["put"],
    url: '/marketing/quotation/{noPenawaran}',
} satisfies RouteDefinition<["put"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:228
 * @route '/marketing/quotation/{noPenawaran}'
 */
update.url = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions) => {
    if (typeof args === 'string' || typeof args === 'number') {
        args = { noPenawaran: args }
    }

    
    if (Array.isArray(args)) {
        args = {
                    noPenawaran: args[0],
                }
    }

    args = applyUrlDefaults(args)

    const parsedArgs = {
                        noPenawaran: args.noPenawaran,
                }

    return update.definition.url
            .replace('{noPenawaran}', parsedArgs.noPenawaran.toString())
            .replace(/\/+$/, '') + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:228
 * @route '/marketing/quotation/{noPenawaran}'
 */
update.put = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteDefinition<'put'> => ({
    url: update.url(args, options),
    method: 'put',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:228
 * @route '/marketing/quotation/{noPenawaran}'
 */
    const updateForm = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: update.url(args, {
                    [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                        _method: 'PUT',
                        ...(options?.query ?? options?.mergeQuery ?? {}),
                    }
                }),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::update
 * @see app/Http/Controllers/Marketing/QuotationController.php:228
 * @route '/marketing/quotation/{noPenawaran}'
 */
        updateForm.put = (args: { noPenawaran: string | number } | [noPenawaran: string | number ] | string | number, options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: update.url(args, {
                        [options?.mergeQuery ? 'mergeQuery' : 'query']: {
                            _method: 'PUT',
                            ...(options?.query ?? options?.mergeQuery ?? {}),
                        }
                    }),
            method: 'post',
        })
    
    update.form = updateForm
/**
* @see \App\Http\Controllers\Marketing\QuotationController::store
 * @see app/Http/Controllers/Marketing/QuotationController.php:335
 * @route '/marketing/quotation'
 */
export const store = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

store.definition = {
    methods: ["post"],
    url: '/marketing/quotation',
} satisfies RouteDefinition<["post"]>

/**
* @see \App\Http\Controllers\Marketing\QuotationController::store
 * @see app/Http/Controllers/Marketing/QuotationController.php:335
 * @route '/marketing/quotation'
 */
store.url = (options?: RouteQueryOptions) => {
    return store.definition.url + queryParams(options)
}

/**
* @see \App\Http\Controllers\Marketing\QuotationController::store
 * @see app/Http/Controllers/Marketing/QuotationController.php:335
 * @route '/marketing/quotation'
 */
store.post = (options?: RouteQueryOptions): RouteDefinition<'post'> => ({
    url: store.url(options),
    method: 'post',
})

    /**
* @see \App\Http\Controllers\Marketing\QuotationController::store
 * @see app/Http/Controllers/Marketing/QuotationController.php:335
 * @route '/marketing/quotation'
 */
    const storeForm = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
        action: store.url(options),
        method: 'post',
    })

            /**
* @see \App\Http\Controllers\Marketing\QuotationController::store
 * @see app/Http/Controllers/Marketing/QuotationController.php:335
 * @route '/marketing/quotation'
 */
        storeForm.post = (options?: RouteQueryOptions): RouteFormDefinition<'post'> => ({
            action: store.url(options),
            method: 'post',
        })
    
    store.form = storeForm
const quotation = {
    index: Object.assign(index, index),
create: Object.assign(create, create),
edit: Object.assign(edit, edit),
print: Object.assign(print, print),
update: Object.assign(update, update),
detail: Object.assign(detail, detail),
store: Object.assign(store, store),
}

export default quotation